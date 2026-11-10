import type { Prisma } from "../../../generated/prisma/client";
import { dateToDb, dbToDate } from "../../training/training.validation";
import { activityWorkoutId } from "../../training/workout-activity";
import { localCoachDate } from "../coach-status";
import { BadRequestException } from "@nestjs/common";
import { planningGoalsMatch } from "../goals/planning-goals";
import { goalResponse } from "../goals/goal-lifecycle.repository";

export async function readCycleReviewData(
  db: Prisma.TransactionClient,
  userId: string,
  range?: { startDate: string; endDate: string },
  now = new Date(),
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const today = localCoachDate(now, user.timezone);
  const endDate = range?.endDate ?? today;
  const startDate =
    range?.startDate ??
    dbToDate(new Date(dateToDb(endDate).getTime() - 6 * 86400000));
  const days =
    (dateToDb(endDate).getTime() - dateToDb(startDate).getTime()) / 86400000 +
    1;
  if (!Number.isInteger(days) || days < 1 || days > 84 || endDate > today)
    throw new BadRequestException({
      code: "INVALID_REVIEW_RANGE",
      message: "请选择截至今天的连续 1–84 天复盘范围",
    });
  const recentStart = new Date(dateToDb(today).getTime() - 2 * 86400000);
  const [plan, records, recent, goals, availability, profile, ftp, tests] =
    await Promise.all([
      db.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: {
          activeVersion: {
            include: {
              workouts: {
                where: {
                  scheduledDate: {
                    gte: dateToDb(startDate),
                    lte: dateToDb(endDate),
                  },
                },
                orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
              },
            },
          },
        },
      }),
      db.trainingActivity.findMany({
        where: {
          userId,
          localDate: { gte: dateToDb(startDate), lte: dateToDb(endDate) },
        },
        orderBy: [{ localDate: "asc" }, { createdAt: "asc" }],
      }),
      db.trainingActivity.findMany({
        where: {
          userId,
          localDate: { gte: recentStart, lte: dateToDb(today) },
        },
        orderBy: [{ localDate: "desc" }, { createdAt: "desc" }],
      }),
      db.trainingGoal.findMany({
        where: { userId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
      }),
      db.trainingAvailability.findUnique({ where: { userId } }),
      db.athleteProfile.findUnique({ where: { userId } }),
      db.abilityMeasurement.findMany({
        where: {
          userId,
          metricType: "FTP",
          unit: "W",
          measuredAt: { lte: now },
        },
        orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
        take: 2,
      }),
      db.trainingAssessment.findMany({
        where: {
          userId,
          OR: [
            {
              actualDate: { gte: dateToDb(startDate), lte: dateToDb(endDate) },
            },
            {
              actualDate: null,
              localDate: { gte: dateToDb(startDate), lte: dateToDb(endDate) },
            },
          ],
        },
        orderBy: [{ localDate: "desc" }, { id: "asc" }],
      }),
    ]);
  const goal = goals.find((g) => g.priority === "PRIMARY") ?? goals[0] ?? null;
  const roadmap = goal
    ? await db.trainingStagePlan.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { stages: { orderBy: { startDate: "asc" } } },
      })
    : null;
  const active = plan?.activeVersion?.workouts ?? [];
  const identities = new Set(active.map(activityWorkoutId));
  // Preserve records of original immutable workouts even when a later plan no
  // longer contains them. Never count copies of the same activity twice.
  const originalIds = records.flatMap((r) =>
    r.workoutId && !identities.has(r.workoutId) ? [r.workoutId] : [],
  );
  const originals = originalIds.length
    ? await db.workout.findMany({
        where: {
          id: { in: originalIds },
          planVersion: { plan: { userId }, appliedAt: { not: null } },
        },
        orderBy: { id: "asc" },
      })
    : [];
  return {
    user,
    today,
    startDate,
    endDate,
    plan,
    records,
    recent,
    goals,
    goal,
    availability,
    profile,
    ftp,
    tests,
    roadmap,
    roadmapGoalsCurrent:
      !!roadmap &&
      planningGoalsMatch(roadmap.goalsSnapshot, goals.map(goalResponse)),
    active,
    originals,
  };
}
export type CycleReviewData = Awaited<ReturnType<typeof readCycleReviewData>>;
