import { Injectable } from "@nestjs/common";
import { coachOverviewSchema } from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { workoutActivities } from "../training/workout-activity";
import { dbToDate } from "../training/training.validation";
import { coachStatus, localCoachDate } from "./coach-status";

@Injectable()
export class CoachOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, now = new Date()) {
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        const localDate = localCoachDate(now, user.timezone);
        const today = new Date(`${localDate}T00:00:00.000Z`);
        const since = new Date(today);
        since.setUTCDate(since.getUTCDate() - 6);
        const [
          plan,
          goal,
          activities,
          races,
          assessments,
          nextAssessment,
          availability,
          ftp,
        ] = await Promise.all([
          tx.trainingPlan.findFirst({
            where: { userId, status: "ACTIVE" },
            include: {
              activeVersion: {
                include: {
                  workouts: {
                    where: { scheduledDate: { gte: today } },
                    orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
                  },
                },
              },
            },
          }),
          tx.trainingGoal.findFirst({
            where: { userId, status: "ACTIVE", priority: "PRIMARY" },
            orderBy: { updatedAt: "desc" },
          }),
          tx.trainingActivity.findMany({
            where: { userId, localDate: { gte: since, lte: today } },
            orderBy: [{ localDate: "desc" }, { createdAt: "desc" }],
          }),
          tx.trainingRaceResult.findMany({
            where: { userId, actualDate: { gte: since, lte: today } },
            include: { race: true },
            orderBy: { actualDate: "desc" },
          }),
          tx.trainingAssessment.findMany({
            where: {
              userId,
              status: "COMPLETED",
              actualDate: { gte: since, lte: today },
            },
            orderBy: { actualDate: "desc" },
          }),
          tx.trainingAssessment.findFirst({
            where: { userId, status: { in: ["SCHEDULED", "POSTPONED"] } },
            orderBy: { localDate: "asc" },
          }),
          tx.trainingAvailability.findUnique({ where: { userId } }),
          tx.abilityMeasurement.findFirst({
            where: { userId, metricType: "FTP", unit: "W" },
            orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
          }),
        ]);
        const roadmap = goal
          ? await tx.trainingStagePlan.findFirst({
              where: { userId, goalId: goal.id, status: "ACTIVE" },
              include: { stages: { orderBy: { startDate: "asc" } } },
            })
          : null;
        const stale =
          !!roadmap &&
          (roadmap.goalVersion !== goal?.version ||
            roadmap.profileVersion !== user.profileVersion ||
            roadmap.availabilityVersion !== availability?.version ||
            roadmap.ftpMeasurementId !== ftp?.id);
        const stage = !stale
          ? roadmap?.stages.find((s) => s.endDate >= today)
          : null;
        const workouts = plan?.activeVersion?.workouts ?? [];
        const recorded = await workoutActivities(tx, userId, workouts);
        const next = workouts.find((workout) => !recorded.has(workout.id));
        const versions = plan
          ? await tx.planVersion.findMany({
              where: { planId: plan.id, appliedAt: { not: null } },
              orderBy: { versionNo: "desc" },
              take: 5,
            })
          : [];
        return coachOverviewSchema.parse({
          localDate,
          timezone: user.timezone,
          planVersion: plan?.activeVersion?.versionNo ?? 0,
          goal: goal
            ? {
                id: goal.id,
                title: goal.description || goal.type,
                targetDate: dbToDate(goal.targetDate),
              }
            : null,
          stage: stage
            ? {
                id: stage.id,
                title: stage.title,
                purpose: stage.purpose,
                startDate: dbToDate(stage.startDate),
                endDate: dbToDate(stage.endDate),
                upcoming: stage.startDate > today,
              }
            : null,
          stageNotice: stale
            ? "目标、FTP 或训练资料已变化，请检查阶段安排"
            : !stage
              ? roadmap
                ? "已到阶段安排末尾，请复评后规划后续阶段"
                : "尚未确认阶段安排，可在目标详情生成并预览"
              : null,
          status: coachStatus(
            localDate,
            activities,
            races,
            assessments,
            plan?.activeVersion?.appliedAt ?? null,
          ),
          nextWorkout: next
            ? {
                id: next.id,
                date: dbToDate(next.scheduledDate),
                title: next.title || "骑行训练",
                minutes: next.timeTargetMin ? Number(next.timeTargetMin) : null,
              }
            : null,
          upcomingWorkouts: workouts
            .filter((w) => !recorded.has(w.id))
            .slice(0, 14)
            .map((w) => ({
              id: w.id,
              date: dbToDate(w.scheduledDate),
              title: w.title || "骑行训练",
              minutes: w.timeTargetMin ? Number(w.timeTargetMin) : null,
              purpose: w.purpose,
            })),
          nextAssessment: nextAssessment
            ? {
                id: nextAssessment.id,
                date: dbToDate(nextAssessment.localDate),
                title: nextAssessment.protocol,
                overdue: nextAssessment.localDate < today,
              }
            : null,
          versions: versions.map((v) => ({
            id: v.id,
            version: v.versionNo,
            reason: v.changeReason,
            appliedAt: v.appliedAt?.toISOString() ?? null,
            active: v.id === plan?.activeVersionId,
          })),
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
