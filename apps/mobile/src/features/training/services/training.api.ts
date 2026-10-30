import {
  applyProposalResponseSchema,
  calendarResponseSchema,
  nextWorkoutResponseSchema,
  proposalResponseSchema,
  type ApplyProposalResponse,
  type CalendarResponse,
  type CreateManualWorkoutProposal,
  type EditWorkoutProposal,
  type ManualWorkoutDraft,
  type ProposalResponse,
  type UpdateProposal,
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

export class TrainingApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new TrainingApiError(
        typeof payload?.message === "string"
          ? payload.message
          : "训练请求失败，请稍后重试",
        response.status,
        typeof payload?.code === "string" ? payload.code : undefined,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof TrainingApiError) throw error;
    throw new TrainingApiError(
      controller.signal.aborted
        ? "连接超时，请检查网络后重试"
        : "无法连接训练服务",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const trainingApi = {
  async getNextWorkout(accessToken: string) {
    const data = await request<unknown>("workouts/next", accessToken);
    return nextWorkoutResponseSchema.parse(data).workout;
  },
  async getProposal(
    accessToken: string,
    proposalId: string,
  ): Promise<ProposalResponse> {
    const data = await request<unknown>(
      `proposals/${encodeURIComponent(proposalId)}`,
      accessToken,
    );
    const parsed = proposalResponseSchema.safeParse(data);
    if (!parsed.success) throw new TrainingApiError("课程草稿数据无效", null);
    return parsed.data;
  },
  async getCalendar(
    accessToken: string,
    from: string,
    to: string,
  ): Promise<CalendarResponse> {
    const data = await request<unknown>(
      `calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      accessToken,
    );
    const parsed = calendarResponseSchema.safeParse(data);
    if (!parsed.success) throw new TrainingApiError("训练日历数据无效", null);
    return parsed.data;
  },
  async getWorkout(
    accessToken: string,
    workoutId: string,
  ): Promise<ProposalResponse["draftWorkout"]> {
    const data = await request<unknown>(`workouts/${workoutId}`, accessToken);
    const parsed = proposalResponseSchema.shape.draftWorkout.safeParse(data);
    if (!parsed.success) throw new TrainingApiError("课程详情数据无效", null);
    return parsed.data;
  },
  async createManual(accessToken: string, input: CreateManualWorkoutProposal) {
    const data = await request<unknown>(
      "workouts/manual-proposals",
      accessToken,
      { method: "POST", body: input },
    );
    const parsed = proposalResponseSchema.safeParse(data);
    if (!parsed.success) throw new TrainingApiError("课程草稿数据无效", null);
    return parsed.data;
  },
  async createEdit(
    accessToken: string,
    workoutId: string,
    input: EditWorkoutProposal,
  ) {
    const data = await request<unknown>(
      `workouts/${workoutId}/edit-proposal`,
      accessToken,
      { method: "POST", body: input },
    );
    const parsed = proposalResponseSchema.safeParse(data);
    if (!parsed.success) throw new TrainingApiError("课程草稿数据无效", null);
    return parsed.data;
  },
  async updateProposal(
    accessToken: string,
    proposalId: string,
    input: UpdateProposal,
  ) {
    const data = await request<unknown>(
      `proposals/${proposalId}`,
      accessToken,
      { method: "PATCH", body: input },
    );
    const parsed = proposalResponseSchema.safeParse(data);
    if (!parsed.success) throw new TrainingApiError("课程草稿数据无效", null);
    return parsed.data;
  },
  async validate(accessToken: string, proposalId: string) {
    const data = await request<unknown>(
      `proposals/${proposalId}/validate`,
      accessToken,
      { method: "POST" },
    );
    const parsed = proposalResponseSchema.safeParse(data);
    if (!parsed.success) throw new TrainingApiError("课程校验数据无效", null);
    return parsed.data;
  },
  async apply(
    accessToken: string,
    proposalId: string,
    expectedBaseVersion: number,
    idempotencyKey: string,
  ): Promise<ApplyProposalResponse> {
    const data = await request<unknown>(
      `proposals/${proposalId}/apply`,
      accessToken,
      { method: "POST", body: { expectedBaseVersion }, idempotencyKey },
    );
    const parsed = applyProposalResponseSchema.safeParse(data);
    if (!parsed.success)
      throw new TrainingApiError("训练计划应用结果无效", null);
    return parsed.data;
  },
};

export type TrainingDraft = ManualWorkoutDraft;
