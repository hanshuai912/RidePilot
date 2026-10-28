import type { AiProposalResponse } from "@ridepilot/contracts";

import { coachApi } from "./coach.api";

type Generation = Awaited<ReturnType<typeof coachApi.generate>>;

const generationErrorMessages: Record<string, string> = {
  NO_REMAINING_TRAINING_DATES: "本周没有剩余可训练日期，请改为从下周开始",
  TRAINING_DATE_CONFLICT: "生成课程包含不可用日期，请改为从下周开始",
  TRAINING_TIME_CONFLICT: "生成课程超出可训练时间，请检查训练时间设置",
  PLAN_VERSION_CONFLICT: "训练计划已更新，请返回 AI 教练重新生成",
};

export async function waitForCoachProposal(
  token: string,
  initial: Generation,
  onStatus: (status: "QUEUED" | "RUNNING") => void,
  isActive: () => boolean,
): Promise<AiProposalResponse | null> {
  let job = initial;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!isActive()) return null;
    if (job.status === "READY") {
      if (!job.proposalId) throw new Error("生成完成但未收到计划草稿");
      return coachApi.proposal(token, job.proposalId);
    }
    if (job.status === "FAILED") {
      const code = job.errorCode ?? "AI_GENERATION_FAILED";
      throw new Error(generationErrorMessages[code] ?? `生成失败：${code}`);
    }
    onStatus(job.status);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!isActive()) return null;
    job = await coachApi.generation(token, job.generationId);
  }
  throw new Error("生成等待超时，请重试；正式计划没有变化");
}
