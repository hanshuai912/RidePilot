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
    CUSTOM: "自定义目标",
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
    CANCELLED: "已取消",
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
