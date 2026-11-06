import { cycleReviewEvidenceSchema } from "@ridepilot/contracts";
import { stageReviewEvidenceSchema } from "@ridepilot/contracts";
import { resolveStageReview } from "./goals/stage-review.repository";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { buildCycleReview } from "./cycle-review/cycle-review.policy";
import { readCycleReviewData } from "./cycle-review/cycle-review.repository";
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
        const cycleReviewStale: Record<string, boolean> = {};
        const stageReviewStale: Record<string, boolean> = {};
        for (const p of [
          ...training
            .filter((p) => pendingCoachStatuses.some((s) => s === p.status))
            .map((p) => ({
              id: p.id,
              evidence: (p.draft as Record<string, unknown>).stageReview,
            })),
          ...stages
            .filter((p) => p.status === "DRAFT")
            .map((p) => ({ id: p.id, evidence: p.reviewEvidence })),
        ]) {
          const review = stageReviewEvidenceSchema.safeParse(p.evidence);
          if (!review.success) continue;
          try {
            await resolveStageReview(tx, userId, review.data.id);
          } catch (error) {
            if (
              error instanceof ConflictException ||
              error instanceof NotFoundException
            )
              stageReviewStale[p.id] = true;
            else throw error;
          }
        }
        const fingerprints = new Map<string, string>();
        for (const p of training) {
          if (![...pendingCoachStatuses].some((status) => status === p.status))
            continue;
          const draft = p.draft as Record<string, unknown>;
          const evidence = cycleReviewEvidenceSchema.safeParse(
            draft.cycleReview,
          );
          if (!evidence.success) continue;
          const range = evidence.data.snapshot;
          const key = `${range.startDate}:${range.endDate}`;
          if (!fingerprints.has(key))
            fingerprints.set(
              key,
              buildCycleReview(await readCycleReviewData(tx, userId, range))
                .fingerprint,
            );
          cycleReviewStale[p.id] = fingerprints.get(key) !== range.fingerprint;
        }
        return {
          stageReviewStale,
          cycleReviewStale,
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
