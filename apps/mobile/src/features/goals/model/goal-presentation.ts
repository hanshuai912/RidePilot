import type { z } from "zod";
import type { goalSchema } from "@ridepilot/contracts";

export type GoalRecord = z.infer<typeof goalSchema>;

export const goalStatusLabel = (goal: GoalRecord) =>
  goal.status === "ACTIVE"
    ? "进行中"
    : goal.status === "PAUSED"
      ? "已暂停"
      : goal.closureReason === "COMPLETED"
        ? "已完成"
        : "已结束";

export function goalDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}
