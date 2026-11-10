import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  stageReviewEvidenceSchema,
  stageReviewSnapshotSchema,
} from "@ridepilot/contracts";
import type {
  Prisma,
  TrainingStageReview,
} from "../../../generated/prisma/client";
import { generationFingerprint } from "../../../infra/prisma/generation-candidates";
import { dbToDate } from "../../training/training.validation";
import { readCycleReviewData } from "../cycle-review/cycle-review.repository";
import { buildCycleReview } from "../cycle-review/cycle-review.policy";
import { readGoalContext } from "./goal-lifecycle.repository";
import {
  readPlanningGoals,
  planningGoalsMatch,
  planningHorizon,
} from "./planning-goals";

export const stageReviewStaleReason =
  "阶段复评依据或决定已变化，请重新复评后生成";
export const stageReviewResponse = (r: TrainingStageReview) =>
  stageReviewEvidenceSchema.parse({
    id: r.id,
    stageId: r.stageId,
    outcome: r.outcome,
    decision: r.decision,
    rationale: r.rationale,
    snapshot: r.snapshot,
    createdAt: r.createdAt.toISOString(),
  });

export async function readStageSnapshot(
  db: Prisma.TransactionClient,
  userId: string,
  id: string,
) {
  const stage = await db.trainingStage.findFirst({
    where: { id, stagePlan: { userId } },
    include: { stagePlan: true },
  });
  if (!stage)
    throw new NotFoundException({
      code: "STAGE_NOT_FOUND",
      message: "阶段不存在",
    });
  const ctx = await readGoalContext(db, userId, stage.stagePlan.goalId);
  const goals = await readPlanningGoals(db, userId);
  const active = ctx.stages[0];
  const stale =
    !planningGoalsMatch(stage.stagePlan.goalsSnapshot, goals) ||
    stage.stagePlan.status !== "ACTIVE" ||
    stage.stagePlan.goalVersion !== ctx.goal.version ||
    stage.stagePlan.profileVersion !== ctx.user.profileVersion ||
    stage.stagePlan.ftpMeasurementId !== ctx.ftp?.id ||
    stage.stagePlan.availabilityVersion !== ctx.availability?.version;
  const next = active?.stages.find(
    (s) => active.id === stage.stagePlanId && s.position === stage.position + 1,
  );
  const tests = await db.trainingAssessment.findMany({
    where: { userId, stageId: id },
    orderBy: [{ localDate: "desc" }, { id: "asc" }],
  });
  const startDate = dbToDate(stage.startDate);
  const endDate = dbToDate(stage.endDate);
  const cycle =
    startDate <= ctx.localDate
      ? buildCycleReview(
          await readCycleReviewData(db, userId, {
            startDate,
            endDate: endDate < ctx.localDate ? endDate : ctx.localDate,
          }),
        )
      : null;
  const data = {
    localDate: ctx.localDate,
    goalId: ctx.goal.id,
    goalVersion: ctx.goal.version,
    goalStatus: ctx.goal.status,
    goalTargetDate: goals.length
      ? planningHorizon(goals)
      : dbToDate(ctx.goal.targetDate),
    stageId: id,
    stagePlanId: stage.stagePlanId,
    stagePlanVersion: stage.stagePlan.version,
    stageTitle: stage.title,
    startDate,
    endDate,
    criteria: stage.criteria,
    criteriaVersion: stage.criteriaVersion,
    stale,
    nextStage: next
      ? {
          id: next.id,
          title: next.title,
          startDate: dbToDate(next.startDate),
          endDate: dbToDate(next.endDate),
        }
      : null,
    training: cycle
      ? {
          planned: cycle.stats.planned,
          completed: cycle.stats.completed,
          partial: cycle.stats.partial,
          skipped: cycle.stats.skipped,
          unrecorded: cycle.stats.unrecorded,
          actualMinutes: cycle.stats.actualMinutes,
        }
      : {
          planned: 0,
          completed: 0,
          partial: 0,
          skipped: 0,
          unrecorded: 0,
          actualMinutes: null,
        },
    tests: tests.map((t) => ({
      id: t.id,
      version: t.version,
      date: dbToDate(t.actualDate ?? t.localDate),
      protocol: t.protocol,
      status: t.status,
      source: t.source,
      watts: t.resultWatts === null ? null : Number(t.resultWatts),
      seconds: t.durationSeconds,
      valid:
        t.status === "COMPLETED" &&
        t.kind !== "LEGACY" &&
        !!t.actualDate &&
        dbToDate(t.actualDate) <= ctx.localDate &&
        !!t.source &&
        !!t.rpe,
    })),
    notices: [
      "日期结束不代表达成。以下结论由你根据达成条件与实际证据确认，不自动更新 FTP、阶段日期或正式课程。",
      "训练统计是阶段日期内截至今天的执行情况；未记录不等于未完成，完成率不等于能力进度。",
      ...(!tests.some((t) => t.status === "COMPLETED")
        ? ["没有已完成的阶段测试；可补测、补充可观察证据，或标记证据不足。"]
        : []),
      ...(stale
        ? [
            "目标、资料或阶段安排已变化。可以记录历史复评；后续应重新规划阶段，不能沿用旧阶段生成课程。",
          ]
        : []),
      ...(cycle?.notices ?? []),
    ],
  };
  return stageReviewSnapshotSchema.parse({
    ...data,
    fingerprint: generationFingerprint({
      data,
      goals,
      cycleFingerprint: cycle?.fingerprint,
      ftp: ctx.ftp,
      availability: ctx.availability,
      profileVersion: ctx.user.profileVersion,
      planVersionId: ctx.plan?.activeVersionId,
    }),
  });
}

export async function resolveStageReview(
  db: Prisma.TransactionClient,
  userId: string,
  id: string,
) {
  const row = await db.trainingStageReview.findFirst({ where: { id, userId } });
  if (!row)
    throw new NotFoundException({
      code: "STAGE_REVIEW_NOT_FOUND",
      message: "阶段复评不存在",
    });
  const latest = await db.trainingStageReview.findFirst({
    where: { userId, stageId: row.stageId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const evidence = stageReviewResponse(row);
  const current = await readStageSnapshot(db, userId, row.stageId);
  if (
    latest?.id !== id ||
    evidence.snapshot.fingerprint !== current.fingerprint
  )
    throw new ConflictException({
      code: "STAGE_REVIEW_STALE",
      message: stageReviewStaleReason,
    });
  return evidence;
}
