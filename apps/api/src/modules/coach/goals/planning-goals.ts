import { ConflictException } from "@nestjs/common";
import { z } from "zod";
import { goalSchema } from "@ridepilot/contracts";
import type { Prisma } from "../../../generated/prisma/client";
import { generationFingerprint } from "../../../infra/prisma/generation-candidates";
import { goalResponse } from "./goal-lifecycle.repository";

export const planningSnapshotSchema = z.object({
  goals: z.array(goalSchema).min(1),
  tradeoffs: z.array(z.string()).default([]),
});
export type PlanningGoals = z.infer<typeof planningSnapshotSchema>["goals"];

export async function readPlanningGoals(
  db: Prisma.TransactionClient,
  userId: string,
) {
  const rows = await db.trainingGoal.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { id: "asc" },
  });
  return rows
    .map(goalResponse)
    .sort(
      (a, b) =>
        Number(b.priority === "PRIMARY") - Number(a.priority === "PRIMARY") ||
        a.id.localeCompare(b.id),
    );
}

export function primaryPlanningGoal(goals: PlanningGoals) {
  const primary = goals.filter((goal) => goal.priority === "PRIMARY");
  if (primary.length !== 1)
    throw new ConflictException({
      code: "PRIMARY_GOAL_REQUIRED",
      message: "请先在目标管理中确定一个进行中的主目标，再统一规划训练",
    });
  return primary[0];
}

// A null snapshot identifies a legacy, single-goal roadmap/draft. Never
// silently present it as a roadmap that has considered the whole goal set.
export function planningGoalsMatch(snapshot: unknown, goals: PlanningGoals) {
  const parsed = planningSnapshotSchema.safeParse(snapshot);
  return (
    parsed.success &&
    generationFingerprint(
      [...parsed.data.goals].sort((a, b) => a.id.localeCompare(b.id)),
    ) ===
      generationFingerprint([...goals].sort((a, b) => a.id.localeCompare(b.id)))
  );
}

export function planningHorizon(goals: PlanningGoals) {
  return goals
    .map((goal) => goal.targetDate)
    .sort()
    .at(-1)!;
}

export const planningInstructions =
  "统筹 planningGoals 中全部进行中目标，只生成一套共享训练安排；PRIMARY 决定主要训练重点，SECONDARY 在可训练时间、恢复与赛事约束内兼顾，不得为每个目标叠加完整训练量。目标日期不同应分期兼顾。必须返回 goalTradeoffs 数组；无法兼顾的期限、训练重点或训练量冲突须在其中具体说明优先保留什么、牺牲什么及原因，供用户确认，没有取舍则返回空数组。不要承诺全部目标必然达成。测试按能力需求统一安排建议，相同测试可用于多个目标的复评，不能据一次测试自动确认所有目标达成。";
