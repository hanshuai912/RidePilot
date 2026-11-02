import type { Assessment } from "@ridepilot/contracts";
export const assessmentKinds = {
  FTP: "FTP 测试",
  POWER_DURATION: "持续输出",
  FIXED_ROUTE: "固定路线",
  LEGACY: "旧版测试",
};
export const assessmentStatuses = {
  SCHEDULED: "待测试",
  POSTPONED: "已改期",
  COMPLETED: "已完成",
  INCOMPLETE: "未完成",
  SKIPPED: "已跳过",
  INVALID: "结果无效",
};
export const assessmentSources = {
  TRAINER: "骑行台",
  POWER_METER: "功率计",
  DEVICE_REPORT: "设备报告",
  MANUAL: "手动记录",
};
export function assessmentResult(item: Assessment) {
  if (item.resultWatts !== null)
    return `${item.kind === "FTP" ? "FTP" : item.kind === "LEGACY" ? "旧版功率记录（类型未知）" : "平均功率"} ${item.resultWatts} W${item.durationSeconds ? ` · ${item.durationSeconds} 秒` : ""}`;
  if (item.durationSeconds)
    return `${item.routeName ?? "路线"} · ${item.durationSeconds} 秒 · ${item.distanceKm} km`;
  return "尚无有效测量结果";
}
