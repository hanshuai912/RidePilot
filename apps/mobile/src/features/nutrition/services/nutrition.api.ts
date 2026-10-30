import {
  applyNutritionProposalResponseSchema,
  nutritionGenerationInputSchema,
  nutritionPlanResponseSchema,
  nutritionProfileResponseSchema,
  nutritionProposalResponseSchema,
  generationResponseSchema,
  type NutritionGenerationInput,
  type NutritionPlanResponse,
  type NutritionProfileInput,
  type NutritionProfileResponse,
  type NutritionProposalResponse,
  type CreateNutritionMealSwapProposal,
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

export class NutritionApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
  ) {
    super(message);
  }
}

type Schema<T> = { safeParse: (value: unknown) => { success: boolean; data?: T } };

async function request<T>(
  path: string,
  accessToken: string,
  schema: Schema<T>,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = payload as Record<string, unknown> | null;
      throw new NutritionApiError(
        typeof error?.message === "string" ? error.message : "饮食服务请求失败，请稍后重试",
        response.status,
        typeof error?.code === "string" ? error.code : undefined,
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success || parsed.data === undefined) {
      throw new NutritionApiError("饮食服务返回的数据无效", null, "INVALID_RESPONSE");
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof NutritionApiError) throw error;
    throw new NutritionApiError(
      controller.signal.aborted ? "连接超时，请检查网络后重试" : "无法连接饮食服务",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function key() {
  return `nutrition-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const nutritionApi = {
  getProfile: (token: string) =>
    request("nutrition/profile", token, nutritionProfileResponseSchema),
  saveProfile: (token: string, input: NutritionProfileInput) =>
    request("nutrition/profile", token, nutritionProfileResponseSchema, {
      method: "PUT",
      body: input,
    }),
  getPlan: (token: string, date: string) =>
    request(
      `nutrition/plan?date=${encodeURIComponent(date)}`,
      token,
      nutritionPlanResponseSchema,
    ),
  generate: (token: string, input: NutritionGenerationInput) =>
    request("nutrition/plans/generate-proposal", token, generationResponseSchema, {
      method: "POST",
      body: nutritionGenerationInputSchema.parse(input),
      idempotencyKey: key(),
    }),
  generation: (token: string, generationId: string) =>
    request(
      `nutrition/generations/${encodeURIComponent(generationId)}`,
      token,
      generationResponseSchema,
    ),
  proposal: (token: string, proposalId: string) =>
    request(
      `nutrition/proposals/${encodeURIComponent(proposalId)}`,
      token,
      nutritionProposalResponseSchema,
    ),
  createMealSwap: (
    token: string,
    input: CreateNutritionMealSwapProposal,
  ) =>
    request("nutrition/meal-swap-proposals", token, nutritionProposalResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey: key(),
    }),
  validate: (token: string, proposalId: string) =>
    request(
      `nutrition/proposals/${encodeURIComponent(proposalId)}/validate`,
      token,
      nutritionProposalResponseSchema,
      { method: "POST" },
    ),
  apply: (token: string, proposalId: string, expectedNutritionVersion: number) =>
    request(
      `nutrition/proposals/${encodeURIComponent(proposalId)}/apply`,
      token,
      applyNutritionProposalResponseSchema,
      {
        method: "POST",
        body: { expectedNutritionVersion },
        idempotencyKey: key(),
      },
    ),
};

export type NutritionApiPlan = NutritionPlanResponse;
export type NutritionApiProfile = NutritionProfileResponse;
export type NutritionApiProposal = NutritionProposalResponse;
