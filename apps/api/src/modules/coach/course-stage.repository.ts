import { ConflictException } from "@nestjs/common";
import type {
  AiProposalResponse,
  WeekGenerationInput,
} from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";
import { generationFingerprint } from "../../infra/prisma/generation-candidates";
import { dateToDb, dbToDate } from "../training/training.validation";
import { planningGoalsMatch } from "./goals/planning-goals";
import {
  addStageDays,
  type CourseStageContext,
  type CourseStageDraft,
} from "./course-stage-planning";

export async function readCourseStageContext(
  db: Prisma.TransactionClient,
  userId: string,
  input: WeekGenerationInput,
  source: {
    goals: NonNullable<AiProposalResponse["planningGoals"]>;
    ftpMeasurementId: string;
    availabilityVersion: number;
    profileVersion: number;
    today: string;
  },
): Promise<CourseStageContext> {
  const active = await db.trainingStagePlan.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { stages: { orderBy: { position: "asc" } } },
  });
  const basePlans = active.map(({ id, version }) => ({ id, version }));
  const current = active.find(
    (plan) =>
      planningGoalsMatch(plan.goalsSnapshot, source.goals) &&
      plan.ftpMeasurementId === source.ftpMeasurementId &&
      plan.availabilityVersion === source.availabilityVersion &&
      plan.profileVersion === source.profileVersion &&
      plan.stages.length > 0,
  );
  const start =
    input.weekStartDate < source.today ? source.today : input.weekStartDate;
  const end = input.endDate ?? addStageDays(input.weekStartDate, 6);
  if (!current)
    return {
      basePlans,
      action: active.length ? "REPLACE" : "CREATE",
      startDate: start,
      endDate: end,
    };
  const startDate = dbToDate(current.startDate);
  const endDate = dbToDate(current.endDate);
  return {
    basePlans,
    action: startDate <= start && endDate >= end ? "REUSE" : "EXTEND",
    startDate: start < startDate ? start : startDate,
    endDate: end > endDate ? end : endDate,
    existing: {
      id: current.id,
      summary: current.summary,
      stages: current.stages.map((stage) => ({
        title: stage.title,
        purpose: stage.purpose,
        assessmentSuggestion: stage.assessmentSuggestion,
        startDate: dbToDate(stage.startDate),
        endDate: dbToDate(stage.endDate),
      })),
    },
  };
}

export const courseStageConflict = "阶段安排已变化，请重新生成课程与阶段草稿";

export async function assertCourseStageBase(
  tx: Prisma.TransactionClient,
  userId: string,
  draft: CourseStageDraft,
) {
  const active = await tx.trainingStagePlan.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, version: true },
  });
  if (
    generationFingerprint(active) !==
    generationFingerprint(draft.context.basePlans)
  )
    throw new ConflictException({
      code: "STAGE_PLAN_VERSION_CONFLICT",
      message: courseStageConflict,
    });
}

// Called inside course publication's transaction, after locking the user and
// checking both course and stage versions. No independent stage publication.
export async function applyCourseStages(
  tx: Prisma.TransactionClient,
  userId: string,
  draft: CourseStageDraft,
  source: {
    goalId: string;
    goalVersion: number;
    ftpMeasurementId: string;
    availabilityVersion: number;
    profileVersion: number;
    model: string;
    skillVersion: string;
    goalsSnapshot?: unknown;
    stageReview?: unknown;
  },
) {
  const { plan, context } = draft;
  if (plan.action === "REUSE") return;
  if (plan.action === "EXTEND" && context.existing) {
    const existing = context.existing;
    // Reindex through unused positions to preserve IDs, reviews and test links.
    const rows = await tx.trainingStage.findMany({
      where: { stagePlanId: existing.id },
      orderBy: { position: "asc" },
    });
    for (const row of rows)
      await tx.trainingStage.update({
        where: { id: row.id },
        data: { position: row.position + 100 },
      });
    for (const [position, stage] of plan.stages.entries()) {
      const old = rows.find(
        (row) => dbToDate(row.startDate) === stage.startDate,
      );
      if (old)
        await tx.trainingStage.update({
          where: { id: old.id },
          data: { position },
        });
      else
        await tx.trainingStage.create({
          data: {
            ...stage,
            stagePlanId: existing.id,
            position,
            startDate: dateToDb(stage.startDate),
            endDate: dateToDb(stage.endDate),
          },
        });
    }
    await tx.trainingStagePlan.update({
      where: { id: existing.id },
      data: {
        startDate: dateToDb(plan.startDate),
        endDate: dateToDb(plan.endDate),
        version: { increment: 1 },
      },
    });
    return;
  }
  await tx.trainingStagePlan.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "ARCHIVED", version: { increment: 1 } },
  });
  await tx.trainingStagePlan.create({
    data: {
      userId,
      generationId: draft.generationId,
      goalId: source.goalId,
      goalVersion: source.goalVersion,
      ftpMeasurementId: source.ftpMeasurementId,
      availabilityVersion: source.availabilityVersion,
      profileVersion: source.profileVersion,
      goalsSnapshot: source.goalsSnapshot as Prisma.InputJsonValue,
      ...(source.stageReview
        ? { reviewEvidence: source.stageReview as Prisma.InputJsonValue }
        : {}),
      baseStagePlanId: context.basePlans[0]?.id ?? null,
      status: "ACTIVE",
      version: 2,
      summary: plan.summary,
      startDate: dateToDb(plan.startDate),
      endDate: dateToDb(plan.endDate),
      model: source.model,
      skillVersion: source.skillVersion,
      stages: {
        create: plan.stages.map((stage, position) => ({
          ...stage,
          position,
          startDate: dateToDb(stage.startDate),
          endDate: dateToDb(stage.endDate),
        })),
      },
    },
  });
}
