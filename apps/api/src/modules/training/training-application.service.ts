import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  applyProposalResponseSchema,
  manualWorkoutDraftSchema,
  type ApplyProposal,
  type ApplyProposalResponse,
} from "@ridepilot/contracts";
import type { Prisma, Workout } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { DraftPayload } from "./training.types";
import {
  assertEditableDate,
  dateToDb,
  dbToDate,
  validateDraft,
} from "./training.validation";
import { CoachProposalService } from "../coach/coach-proposal.service";
import { PlanRestoreService } from "../coach/plan-restore.service";

@Injectable()
export class TrainingApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coachProposals: CoachProposalService,
    private readonly restore: PlanRestoreService,
  ) {}

  async applyProposal(
    userId: string,
    proposalId: string,
    input: ApplyProposal,
    idempotencyKey: string,
  ): Promise<ApplyProposalResponse> {
    const type = await this.prisma.changeProposal.findFirst({
      where: { id: proposalId, userId },
      select: { proposalType: true },
    });
    if (type && this.coachProposals.isAiProposal(type.proposalType))
      return this.coachProposals.apply(
        userId,
        proposalId,
        input.expectedBaseVersion,
        idempotencyKey,
      );
    if (type?.proposalType === "PLAN_RESTORE")
      return this.restore.apply(
        userId,
        proposalId,
        input.expectedBaseVersion,
        idempotencyKey,
      );
    if (!idempotencyKey)
      throw new ConflictException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少幂等键",
      });

    const result = await this.prisma.$transaction(async (tx) => {
      // The user row also exists before the first plan. Lock it to serialize
      // initial publication and retries, including different initial proposals.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const proposal = await tx.changeProposal.findFirst({
        where: { id: proposalId, userId },
      });
      if (!proposal)
        throw new NotFoundException({
          code: "PROPOSAL_NOT_FOUND",
          message: "训练变更草稿不存在",
        });
      if (proposal.appliedVersionId)
        return this.appliedResponse(tx, proposal.appliedVersionId);
      if (proposal.status !== "READY" || !proposal.validationPassed)
        throw new ConflictException({
          code: "PROPOSAL_NOT_READY",
          message: "草稿尚未通过校验",
        });
      const usedKey = await tx.changeProposal.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (usedKey && usedKey.id !== proposalId)
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "幂等键已用于其他训练变更",
        });

      const plan = await tx.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: { include: { workouts: true } } },
      });
      const baseVersion = plan?.activeVersion ?? null;
      if (
        (baseVersion?.id ?? null) !== proposal.baseVersionId ||
        (baseVersion?.versionNo ?? 0) !== input.expectedBaseVersion ||
        (!baseVersion && proposal.proposalType !== "MANUAL_WORKOUT_CREATE")
      )
        throw new ConflictException({
          code: "PLAN_VERSION_CONFLICT",
          message: "训练计划已被其他请求修改，请重新读取后再试",
        });

      // Time and FTP can change between preview and confirmation.
      const draft = proposal.draft as unknown as DraftPayload;
      manualWorkoutDraftSchema.parse(draft);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true },
      });
      assertEditableDate(draft.scheduledDate, user.timezone);
      const ftp = await tx.abilityMeasurement.findFirst({
        where: { userId, metricType: "FTP", unit: "W" },
        orderBy: { measuredAt: "desc" },
      });
      validateDraft(draft, Boolean(ftp && Number(ftp.value) > 0));

      const targetPlan =
        plan ??
        (await tx.trainingPlan.create({
          data: { userId, status: "ACTIVE" },
        }));
      const newVersion = await tx.planVersion.create({
        data: {
          planId: targetPlan.id,
          versionNo: (baseVersion?.versionNo ?? 0) + 1,
          baseVersionId: baseVersion?.id ?? null,
          changeReason: proposal.proposalType,
          appliedAt: new Date(),
        },
      });
      const retained = (baseVersion?.workouts ?? []).filter(
        (old) => old.id !== proposal.targetWorkoutId,
      );
      for (const old of retained)
        await this.copyWorkout(tx, newVersion.id, old);
      const dayOrder = proposal.targetWorkoutId
        ? draft.dayOrder
        : Math.max(
            0,
            ...retained
              .filter(
                (old) => dbToDate(old.scheduledDate) === draft.scheduledDate,
              )
              .map((old) => old.dayOrder),
          ) + 1;
      await this.createWorkout(tx, newVersion.id, { ...draft, dayOrder });

      const switched = await tx.trainingPlan.updateMany({
        where: {
          id: targetPlan.id,
          userId,
          activeVersionId: baseVersion?.id ?? null,
          status: "ACTIVE",
        },
        data: { activeVersionId: newVersion.id },
      });
      if (switched.count !== 1)
        throw new ConflictException({
          code: "PLAN_VERSION_CONFLICT",
          message: "训练计划已被其他请求修改，请重新读取后再试",
        });
      // A concurrent draft change must roll back the entire publication.
      const applied = await tx.changeProposal.updateMany({
        where: {
          id: proposal.id,
          userId,
          status: "READY",
          proposalVersion: proposal.proposalVersion,
        },
        data: {
          status: "APPLIED",
          appliedVersionId: newVersion.id,
          idempotencyKey,
        },
      });
      if (applied.count !== 1)
        throw new ConflictException({
          code: "PROPOSAL_VERSION_CONFLICT",
          message: "草稿已被其他请求修改，请重新读取",
        });
      return this.appliedResponse(tx, newVersion.id);
    });
    return applyProposalResponseSchema.parse(result);
  }

  private async copyWorkout(
    tx: Prisma.TransactionClient,
    planVersionId: string,
    old: Workout,
  ): Promise<void> {
    const created = await tx.workout.create({
      data: {
        planVersionId,
        sportType: old.sportType,
        purpose: old.purpose,
        title: old.title,
        scheduledDate: old.scheduledDate,
        dayOrder: old.dayOrder,
        timeTargetMin: old.timeTargetMin,
        distanceTargetKm: old.distanceTargetKm,
        source: old.source,
        structure: old.structure as Prisma.InputJsonValue,
      },
    });
    await this.createPlanItem(tx, created);
  }

  private async createWorkout(
    tx: Prisma.TransactionClient,
    planVersionId: string,
    draft: DraftPayload,
  ): Promise<void> {
    const totals = validateDraft(draft, true);
    const created = await tx.workout.create({
      data: {
        planVersionId,
        sportType: "cycling",
        title: draft.title ?? null,
        purpose: draft.purpose ?? null,
        scheduledDate: dateToDb(draft.scheduledDate),
        dayOrder: draft.dayOrder,
        timeTargetMin: totals.timeTargetMinutes,
        distanceTargetKm: totals.distanceTargetKm,
        source: "manual",
        structure: { segments: draft.segments },
      },
    });
    await this.createPlanItem(tx, created);
  }

  private async createPlanItem(tx: Prisma.TransactionClient, workout: Workout) {
    await tx.planItem.create({
      data: {
        planVersionId: workout.planVersionId,
        eventType: "WORKOUT",
        scheduledDate: workout.scheduledDate,
        dayOrder: workout.dayOrder,
        workoutId: workout.id,
      },
    });
  }

  private async appliedResponse(
    tx: Prisma.TransactionClient,
    versionId: string,
  ) {
    const version = await tx.planVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { workouts: { select: { scheduledDate: true } } },
    });
    return {
      success: true as const,
      newPlanVersion: version.versionNo,
      affectedDates: [
        ...new Set(version.workouts.map((w) => dbToDate(w.scheduledDate))),
      ].sort(),
    };
  }
}
