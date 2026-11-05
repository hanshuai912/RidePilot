import type { CycleReviewEvidence } from "@ridepilot/contracts";

export const cycleActionLabels: Record<CycleReviewEvidence["action"], string> =
  {
    CONTINUE: "沿用目标生成后续训练",
    RECOVERY: "生成恢复训练",
    ADJUST: "调整后续训练安排",
  };
export const shiftCycleDate = (date: string, days: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  )
    return "";
  return new Date(timestamp + days * 86400000).toISOString().slice(0, 10);
};
export const cycleGoalTitle = (title: string) =>
  ({
    FTP: "提升 FTP",
    ENDURANCE: "提升耐力",
    CLIMBING: "提升爬坡",
    RACE: "准备比赛",
  })[title] ?? title;
export const cycleFtpSource = (source: string) =>
  ({ MANUAL: "手动测量", TEST: "测试测量" })[source] ?? source;
export const cycleStatusLabel = (status: string) =>
  ({
    COMPLETED: "完成",
    PARTIAL: "部分完成",
    SKIPPED: "跳过",
    QUEUED: "排队中",
    RUNNING: "生成中",
    FAILED: "生成失败",
    READY: "草稿待确认",
    DRAFT: "草稿待校验",
    BLOCKED: "校验未通过",
    APPLIED: "已应用",
    EXPIRED: "已失效",
    REJECTED: "已放弃",
    SUPERSEDED: "已被新草稿替代",
    SCHEDULED: "待测试",
    POSTPONED: "已改期",
    INCOMPLETE: "未完成",
    INVALID: "结果无效",
  })[status] ?? status;
export function cycleGenerationError(code: string | null) {
  if (code === "INSUFFICIENT_RECOVERY")
    return "候选包含连续高强度训练，恢复间隔不足。请主动重新生成。";
  if (code === "CYCLE_RECOVERY_INTENSITY")
    return "恢复候选强度超过所选恢复范围，请重新生成。";
  if (
    [
      "CYCLE_REVIEW_STALE",
      "GENERATION_CONTEXT_CHANGED",
      "PLAN_VERSION_CONFLICT",
    ].includes(code ?? "")
  )
    return "生成期间复盘依据或计划已变化，请刷新复盘后重新生成。";
  return `生成失败（${code ?? "AI_GENERATION_FAILED"}），可检查资料后主动重新生成。`;
}
