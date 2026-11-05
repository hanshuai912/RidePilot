import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";

export const pendingCoachStatuses = [
  "DRAFT",
  "PENDING_VALIDATION",
  "READY",
  "BLOCKED",
] as const;
export const coachTrainingTypes = [
  "AI_WEEK_PLAN",
  "AI_WORKOUT_ADJUST",
  "AI_PLAN_ADJUST",
  "AI_ASSESSMENT_REVIEW",
  "AI_RACE_REPLAN",
] as const;

@Injectable()
export class CoachSuggestionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  read(userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Keep all pending work visible even after many newer suggestions have
        // been applied. Only completed history is bounded.
        const [
          plan,
          nutrition,
          user,
          availability,
          ftp,
          goals,
          training,
          food,
          stages,
          jobs,
          races,
          assessments,
          nutritionProfile,
        ] = await Promise.all([
          tx.trainingPlan.findFirst({ where: { userId, status: "ACTIVE" } }),
          tx.nutritionPlan.findFirst({ where: { userId, status: "ACTIVE" } }),
          tx.user.findUniqueOrThrow({ where: { id: userId } }),
          tx.trainingAvailability.findUnique({ where: { userId } }),
          tx.abilityMeasurement.findFirst({
            where: { userId, metricType: "FTP", unit: "W" },
            orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
          }),
          tx.trainingGoal.findMany({ where: { userId, status: "ACTIVE" } }),
          Promise.all([
            tx.changeProposal.findMany({
              where: {
                userId,
                proposalType: { in: [...coachTrainingTypes] },
                status: { in: [...pendingCoachStatuses] },
              },
              orderBy: { createdAt: "desc" },
            }),
            tx.changeProposal.findMany({
              where: {
                userId,
                proposalType: { in: [...coachTrainingTypes] },
                status: { notIn: [...pendingCoachStatuses] },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            }),
          ]).then((parts) => parts.flat()),
          Promise.all([
            tx.nutritionProposal.findMany({
              where: { userId, status: { in: [...pendingCoachStatuses] } },
              orderBy: { createdAt: "desc" },
            }),
            tx.nutritionProposal.findMany({
              where: { userId, status: { notIn: [...pendingCoachStatuses] } },
              orderBy: { createdAt: "desc" },
              take: 10,
            }),
          ]).then((parts) => parts.flat()),
          Promise.all([
            tx.trainingStagePlan.findMany({
              where: { userId, status: { in: ["DRAFT", "ACTIVE"] } },
              orderBy: { createdAt: "desc" },
            }),
            tx.trainingStagePlan.findMany({
              where: { userId, status: { in: ["ARCHIVED", "SUPERSEDED"] } },
              orderBy: { createdAt: "desc" },
              take: 10,
            }),
          ]).then((parts) => parts.flat()),
          Promise.all([
            tx.aiGeneration.findMany({
              where: { userId, status: { in: ["QUEUED", "RUNNING"] } },
              orderBy: { createdAt: "desc" },
            }),
            tx.aiGeneration.findMany({
              where: { userId, status: "FAILED" },
              orderBy: { createdAt: "desc" },
              take: 10,
            }),
          ]).then((parts) => parts.flat()),
          tx.trainingRace.findMany({
            where: { userId },
            select: { id: true, version: true },
          }),
          tx.trainingAssessment.findMany({
            where: { userId },
            select: { id: true, version: true },
          }),
          tx.nutritionProfile.findUnique({ where: { userId } }),
        ]);
        return {
          plan,
          nutrition,
          user,
          availability,
          ftp,
          goals,
          training,
          food,
          stages,
          jobs,
          races,
          assessments,
          nutritionProfile,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
