import type { NutritionProposalResponse } from "@ridepilot/contracts";

import { nutritionApi } from "./nutrition.api";

const errorMessages: Record<string, string> = {
  NUTRITION_PROFILE_REQUIRED: "请先建立饮食档案，再生成营养建议",
  NUTRITION_VERSION_CONFLICT: "正式饮食计划已更新，请刷新后重新生成",
  AI_RETRY_EXHAUSTED: "生成服务暂时繁忙，请稍后重试",
  AI_OUTPUT_INVALID: "AI 返回的营养草稿无法通过结构校验",
};

export async function waitForNutritionProposal(
  token: string,
  initial: Awaited<ReturnType<typeof nutritionApi.generate>>,
  onStatus: (status: "QUEUED" | "RUNNING") => void,
  isActive: () => boolean,
): Promise<NutritionProposalResponse | null> {
  let job = initial;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!isActive()) return null;
    if (job.status === "READY") {
      if (!job.proposalId) throw new Error("营养生成完成但未收到草稿");
      return nutritionApi.proposal(token, job.proposalId);
    }
    if (job.status === "FAILED") {
      throw new Error(errorMessages[job.errorCode ?? ""] ?? "营养草稿生成失败，请稍后重试");
    }
    onStatus(job.status);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!isActive()) return null;
    job = await nutritionApi.generation(token, job.generationId);
  }
  throw new Error("生成等待超时，请重试；正式饮食计划没有变化");
}
