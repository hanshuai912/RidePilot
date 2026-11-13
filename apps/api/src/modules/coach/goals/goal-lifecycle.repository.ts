import { NotFoundException } from "@nestjs/common";
import type { Prisma, TrainingGoal } from "../../../generated/prisma/client";
import { goalSchema } from "@ridepilot/contracts";
import { dateToDb } from "../../training/training.validation";

export const goalResponse = (goal: TrainingGoal) =>
  goalSchema.parse({
    id: goal.id,
    type: goal.type,
    description: goal.description,
    successCriteria: goal.successCriteria,
    targetFtpWatts: goal.targetFtpWatts,
    closureReason: goal.closureReason,
    targetWkg: goal.targetWkg === null ? null : Number(goal.targetWkg),
    priority: goal.priority,
    status: goal.status,
    version: goal.version,
  });

export async function readGoalContext(
  db: Prisma.TransactionClient,
  userId: string,
  goalId: string,
) {
  const goal = await db.trainingGoal.findFirst({
    where: { id: goalId, userId },
  });
  if (!goal)
    throw new NotFoundException({
      code: "GOAL_NOT_FOUND",
      message: "目标不存在",
    });
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: user.timezone,
  }).format(new Date());
  const [
    ftp,
    availability,
    profile,
    plan,
    assessments,
    stages,
    otherActiveGoals,
  ] = await Promise.all([
    db.abilityMeasurement.findFirst({
      where: { userId, metricType: "FTP", unit: "W" },
      orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
    }),
    db.trainingAvailability.findUnique({ where: { userId } }),
    db.athleteProfile.findUnique({ where: { userId } }),
    db.trainingPlan.findFirst({
      where: { userId, status: "ACTIVE" },
      include: {
        activeVersion: {
          include: {
            workouts: {
              where: { scheduledDate: { gte: dateToDb(localDate) } },
              orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
            },
          },
        },
      },
    }),
    db.trainingAssessment.findMany({
      where: { userId, status: { in: ["SCHEDULED", "POSTPONED"] } },
      orderBy: { localDate: "asc" },
    }),
    db.trainingStagePlan.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { stages: { orderBy: { position: "asc" } } },
    }),
    db.trainingGoal.findMany({
      where: {
        userId,
        id: { not: goalId },
        status: "ACTIVE",
      },
      orderBy: { id: "asc" },
    }),
  ]);
  return {
    goal,
    user,
    localDate,
    ftp,
    availability,
    profile,
    plan,
    assessments,
    stages,
    otherActiveGoals,
    otherPrimaryGoals: otherActiveGoals.filter(
      (goal) => goal.priority === "PRIMARY",
    ),
  };
}
export type GoalContext = Awaited<ReturnType<typeof readGoalContext>>;
