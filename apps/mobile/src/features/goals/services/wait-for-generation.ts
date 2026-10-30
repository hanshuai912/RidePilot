import { coachApi } from "../../coach/services/coach.api";

export async function waitForGeneration(
  token: string,
  initial: Awaited<ReturnType<typeof coachApi.generation>>,
  active: () => boolean,
) {
  let job = initial;
  for (let attempt = 0; attempt < 180; attempt++) {
    if (!active()) return null;
    if (job.status === "READY") {
      if (!job.proposalId) throw new Error("生成完成但缺少草稿，请重试");
      return job.proposalId;
    }
    if (job.status === "FAILED")
      throw new Error(
        `生成失败（${job.errorCode ?? "AI_GENERATION_FAILED"}），请重试`,
      );
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!active()) return null;
    job = await coachApi.generation(token, job.generationId);
  }
  throw new Error("生成仍在处理中，请重试继续查询；当前正式计划未改变");
}
