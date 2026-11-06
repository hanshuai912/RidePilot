import { goalInputSchema, type GoalInput } from "@ridepilot/contracts";

export const goalTypeLabels = {
  FTP: "提升 FTP",
  ENDURANCE: "提升耐力",
  CLIMBING: "提升爬坡",
  RACE: "准备比赛",
  CUSTOM: "自定义目标",
};
export const goalActionLabels = {
  UPDATE: "调整目标 / 延期",
  PAUSE: "暂停目标",
  RESUME: "恢复目标",
  COMPLETE: "确认完成目标",
  CLOSE: "结束目标",
  CREATE_NEXT: "建立下一目标",
};
export const outcomeLabels = {
  MET: "用户确认达到预期",
  NOT_MET: "尚未达到预期",
  INSUFFICIENT: "证据不足",
};
export const decisionLabels = {
  KEEP: "保持当前阶段",
  EXTEND: "延长阶段并重新规划",
  ADJUST: "调整后续安排",
  NEXT: "进入下一阶段",
};

export type GoalFormValue = {
  type: GoalInput["type"];
  description: string;
  successCriteria: string;
  targetFtpWatts: string;
  targetWkg: string;
  targetDate: string;
  priority: GoalInput["priority"];
};
export const goalFormValue = (goal?: GoalInput): GoalFormValue => ({
  type: goal?.type ?? "FTP",
  description: goal?.description ?? "",
  successCriteria: goal?.successCriteria ?? "",
  targetFtpWatts: goal?.targetFtpWatts?.toString() ?? "",
  targetWkg: goal?.targetWkg?.toString() ?? "",
  targetDate: goal?.targetDate ?? "",
  priority: goal?.priority ?? "SECONDARY",
});
export function parseGoalForm(value: GoalFormValue): GoalInput {
  const parsed = goalInputSchema.safeParse({
    ...value,
    description: value.description.trim() || null,
    successCriteria: value.successCriteria.trim() || null,
    targetFtpWatts:
      value.type === "FTP" && value.targetFtpWatts.trim()
        ? Number(value.targetFtpWatts)
        : null,
    targetWkg:
      value.type === "FTP" && value.targetWkg.trim()
        ? Number(value.targetWkg)
        : null,
  });
  if (!parsed.success)
    throw new Error(
      "请检查目标日期、达成条件和数值；FTP 为 50–800 W，功体比为 1–10 W/kg。",
    );
  return parsed.data;
}

export const goalTitle = (title: string) =>
  goalTypeLabels[title as keyof typeof goalTypeLabels] ?? title;
