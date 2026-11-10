import { GenerationCancelledError } from "../../../lib/generation-cancelled";
import type { NutritionProposalResponse } from "@ridepilot/contracts";

import { nutritionApi } from "./nutrition.api";

const errorMessages: Record<string, string> = {
  PLAN_VERSION_CONFLICT: "训练计划已更新，请刷新后重新生成补给草稿",
  NUTRITION_PROFILE_REQUIRED: "请先建立饮食档案，再生成营养建议",
  NUTRITION_VERSION_CONFLICT: "正式饮食计划已更新，请刷新后重新生成",
  AI_RETRY_EXHAUSTED: "生成服务暂时繁忙，请稍后重试",
  AI_OUTPUT_INVALID: "AI 返回的营养草稿无法通过结构校验",
  AI_PROVIDER_INVALID_RESPONSE: "生成服务返回了无效响应，请稍后重试",
  AI_PROVIDER_TIMEOUT: "生成服务响应超时，请稍后重试",
  AI_PROVIDER_FAILED: "生成服务暂时不可用，请稍后重试",
  AI_PROVIDER_CONFIG_INVALID: "生成服务尚未配置，请联系管理员",
};

export class NutritionGenerationFailedError extends Error {}

export async function waitForNutritionProposal(
  token: string,
  initial: Awaited<ReturnType<typeof nutritionApi.generate>>,
  onStatus: (status: "QUEUED" | "RUNNING") => void,
  isActive: () => boolean,
): Promise<NutritionProposalResponse | null> {
  let job = initial;
  const deadline = Date.now() + 150_000;
  while (isActive()) {
    if (job.status === "CANCELLED") throw new GenerationCancelledError();
    if (job.status === "READY") {
      if (!job.proposalId)
        throw new NutritionGenerationFailedError("营养生成完成但未收到草稿");
      return nutritionApi.proposal(token, job.proposalId);
    }
    if (job.status === "FAILED") {
      throw new NutritionGenerationFailedError(
        errorMessages[job.errorCode ?? ""] ?? "营养草稿生成失败，请稍后重试",
      );
    }
    if (Date.now() >= deadline) break;
    onStatus(job.status);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!isActive()) return null;
    job = await nutritionApi.generation(token, job.generationId);
  }
  if (!isActive()) return null;
  throw new Error("生成等待超时，请重试；正式饮食计划没有变化");
}
