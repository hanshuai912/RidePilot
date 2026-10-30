import {
  activePlanStatusSchema,
  activityResponseSchema,
  aiProposalResponseSchema,
  applyProposalResponseSchema,
  availabilityResponseSchema,
  ftpMeasurementSchema,
  generationResponseSchema,
  goalSchema,
  readinessSchema,
  type AvailabilityInput,
  type ActivityInput,
  type GoalInput,
  type GoalPatch,
  type WeekGenerationInput,
} from "@ridepilot/contracts";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { resolveApiBaseUrl } from "../../auth/services/api-base-url";

const API_BASE_URL = resolveApiBaseUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  metroHostUri: Constants.expoConfig?.hostUri,
  platform: Platform.OS,
  isDevelopment: __DEV__,
});

export class CoachApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
    readonly missingFields?: string[],
  ) {
    super(message);
  }
}

export async function coachRequest<T>(
  path: string,
  token: string,
  schema: { parse: (value: unknown) => T },
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = payload as Record<string, unknown> | null;
      throw new CoachApiError(
        typeof error?.message === "string" ? error.message : "AI 教练请求失败",
        response.status,
        typeof error?.code === "string" ? error.code : undefined,
        Array.isArray(error?.missingFields)
          ? error.missingFields.filter(
              (value): value is string => typeof value === "string",
            )
          : undefined,
      );
    }
    try {
      return schema.parse(payload);
    } catch {
      throw new CoachApiError(
        "AI 教练返回的数据无效",
        null,
        "INVALID_RESPONSE",
      );
    }
  } catch (error) {
    if (error instanceof CoachApiError) throw error;
    throw new CoachApiError(
      controller.signal.aborted ? "连接超时，请重试" : "无法连接 AI 教练服务",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}

const request = coachRequest;

export const coachApi = {
  planStatus: (token: string) =>
    request("plans/active/status", token, activePlanStatusSchema),
  readiness: (token: string) =>
    request("ai-coach/readiness", token, readinessSchema),
  ftp: (token: string) =>
    request(
      "me/ability-measurements/ftp",
      token,
      ftpMeasurementSchema.nullable(),
    ),
  addFtp: (token: string, valueWatts: number) =>
    request("me/ability-measurements/ftp", token, ftpMeasurementSchema, {
      method: "POST",
      body: {
        valueWatts,
        measuredAt: new Date().toISOString(),
        source: "MANUAL",
      },
    }),
  availability: (token: string) =>
    request("me/availability", token, availabilityResponseSchema.nullable()),
  saveAvailability: (token: string, input: AvailabilityInput) =>
    request("me/availability", token, availabilityResponseSchema, {
      method: "PUT",
      body: input,
    }),
  goals: (token: string) => request("goals", token, goalSchema.array()),
  goal: (token: string, id: string) =>
    request(`goals/${encodeURIComponent(id)}`, token, goalSchema),
  createGoal: (token: string, input: GoalInput) =>
    request("goals", token, goalSchema, { method: "POST", body: input }),
  updateGoal: (token: string, id: string, input: GoalPatch) =>
    request(`goals/${encodeURIComponent(id)}`, token, goalSchema, {
      method: "PATCH",
      body: input,
    }),
  generate: (token: string, input: WeekGenerationInput, key: string) =>
    request("plans/generate-proposal", token, generationResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey: key,
    }),
  adjustPlan: (token: string, input: WeekGenerationInput, key: string) =>
    request("plans/adjust-proposal", token, generationResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey: key,
    }),
  adjustWorkout: (
    token: string,
    workoutId: string,
    input: WeekGenerationInput,
    key: string,
  ) =>
    request(
      `workouts/${encodeURIComponent(workoutId)}/ai-adjust-proposal`,
      token,
      generationResponseSchema,
      { method: "POST", body: input, idempotencyKey: key },
    ),
  generation: (token: string, id: string) =>
    request(
      `ai-coach/generations/${encodeURIComponent(id)}`,
      token,
      generationResponseSchema,
    ),
  proposal: (token: string, id: string) =>
    request(
      `proposals/${encodeURIComponent(id)}`,
      token,
      aiProposalResponseSchema,
    ),
  validate: (token: string, id: string) =>
    request(
      `proposals/${encodeURIComponent(id)}/validate`,
      token,
      aiProposalResponseSchema,
      {
        method: "POST",
      },
    ),
  apply: (
    token: string,
    id: string,
    expectedBaseVersion: number,
    key: string,
  ) =>
    request(
      `proposals/${encodeURIComponent(id)}/apply`,
      token,
      applyProposalResponseSchema,
      {
        method: "POST",
        body: { expectedBaseVersion },
        idempotencyKey: key,
      },
    ),
  recordActivity: (token: string, input: ActivityInput) =>
    request("activities", token, activityResponseSchema, {
      method: "POST",
      body: input,
    }),
};

export type CoachPlanStatus = ReturnType<typeof activePlanStatusSchema.parse>;
