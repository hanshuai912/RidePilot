import {
  activityWorkoutId,
  workoutActivities,
} from "../training/workout-activity";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  manualWorkoutDraftSchema,
  restoreProposalResponseSchema,
} from "@ridepilot/contracts";
import type {
  ChangeProposal,
  Prisma,
  Workout,
} from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import {
  dateToDb,
  dbToDate,
  validateDraft,
} from "../training/training.validation";

interface StoredWorkout {
  activityWorkoutId?: string;
  scheduledDate: string;
  dayOrder: number;
  title: string | null;
  purpose: string | null;
  source: string;
  segments: unknown;
}
interface RestoreDraft {
  targetVersionId: string;
  targetVersionNo: number;
  replaceWorkoutIds: string[];
  workouts: StoredWorkout[];
}

@Injectable()
export class PlanRestoreService {
  constructor(private readonly prisma: PrismaService) {}

  async listVersions(userId: string) {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { userId, status: "ACTIVE" },
    });
    if (!plan) return [];
    const versions = await this.prisma.planVersion.findMany({
      where: { planId: plan.id },
      include: { _count: { select: { workouts: true } } },
      orderBy: { versionNo: "desc" },
    });
    return versions.map((item) => ({
      id: item.id,
      versionNo: item.versionNo,
      changeReason: item.changeReason,
      appliedAt: item.appliedAt?.toISOString() ?? null,
      workoutCount: item._count.workouts,
      active: item.id === plan.activeVersionId,
    }));
  }

  async getVersion(userId: string, id: string) {
    const version = await this.prisma.planVersion.findFirst({
      where: { id, plan: { userId } },
      include: {
        workouts: { orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }] },
      },
    });
    if (!version)
      throw new NotFoundException({
        code: "PLAN_VERSION_NOT_FOUND",
        message: "计划版本不存在",
      });
    return {
      id: version.id,
      versionNo: version.versionNo,
      changeReason: version.changeReason,
      workouts: version.workouts.map((item) => ({
        id: item.id,
        scheduledDate: dbToDate(item.scheduledDate),
        dayOrder: item.dayOrder,
        title: item.title,
        purpose: item.purpose,
        source: item.source,
        timeTargetMinutes: item.timeTargetMin
          ? Number(item.timeTargetMin)
          : null,
        distanceTargetKm: item.distanceTargetKm
          ? Number(item.distanceTargetKm)
          : null,
        segments: (item.structure as { segments: unknown }).segments,
      })),
    };
  }

  async create(
    userId: string,
    targetVersionId: string,
    expectedBaseVersion: number,
  ) {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { activeVersion: { include: { workouts: true } } },
    });
    if (!plan?.activeVersion)
      throw new NotFoundException({
        code: "PLAN_NOT_FOUND",
        message: "正式计划不存在",
      });
    if (plan.activeVersion.versionNo !== expectedBaseVersion)
      throw new ConflictException({
        code: "PLAN_VERSION_CONFLICT",
        message: "计划版本已改变",
      });
    const target = await this.prisma.planVersion.findFirst({
      where: { id: targetVersionId, planId: plan.id },
      include: { workouts: true },
    });
    if (!target)
      throw new NotFoundException({
        code: "PLAN_VERSION_NOT_FOUND",
        message: "历史版本不存在",
      });
    if (target.id === plan.activeVersion.id)
      throw new ConflictException({
        code: "RESTORE_TARGET_IS_CURRENT",
        message: "当前已是该版本",
      });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const today = this.today(user.timezone);
    const currentFuture = plan.activeVersion.workouts.filter(
      (item) => dbToDate(item.scheduledDate) >= today,
    );
    const recordedIds = await workoutActivities(
      this.prisma,
      userId,
      currentFuture,
    );
    const recordedDates = new Set(
      currentFuture
        .filter((item) => recordedIds.has(item.id))
        .map((item) => dbToDate(item.scheduledDate)),
    );
    const replaceWorkoutIds = currentFuture
      .filter((item) => !recordedIds.has(item.id))
      .map((item) => item.id);
    const workouts = target.workouts
      .filter(
        (item) =>
          dbToDate(item.scheduledDate) >= today &&
          !recordedDates.has(dbToDate(item.scheduledDate)),
      )
      .map((item) => this.toStored(item));
    const draft: RestoreDraft = {
      targetVersionId: target.id,
      targetVersionNo: target.versionNo,
      replaceWorkoutIds,
      workouts,
    };
    const proposal = await this.prisma.changeProposal.create({
      data: {
        userId,
        baseVersionId: plan.activeVersion.id,
        proposalType: "PLAN_RESTORE",
        draft: draft as unknown as Prisma.InputJsonValue,
        original: { workoutIds: replaceWorkoutIds },
        status: "DRAFT",
      },
    });
    return this.validate(userId, proposal.id);
  }

  async get(userId: string, id: string) {
    const proposal = await this.find(userId, id);
    const draft = proposal.draft as unknown as RestoreDraft;
    const base = await this.prisma.planVersion.findUniqueOrThrow({
      where: { id: proposal.baseVersionId! },
      select: { versionNo: true },
    });
    return restoreProposalResponseSchema.parse({
      proposalId: id,
      status: proposal.status,
      basePlanVersion: base.versionNo,
      targetPlanVersion: draft.targetVersionNo,
      affectedDates: [
        ...new Set(draft.workouts.map((item) => item.scheduledDate)),
      ].sort(),
      beforeCount: draft.replaceWorkoutIds.length,
      afterCount: draft.workouts.length,
      blockers: proposal.validationBlockers ?? [],
    });
  }

  async validate(userId: string, id: string) {
    const proposal = await this.find(userId, id);
    if (!["DRAFT", "READY", "BLOCKED"].includes(proposal.status))
      throw new ConflictException({
        code: "PROPOSAL_NOT_EDITABLE",
        message: "恢复提案不可校验",
      });
    const blockers = await this.check(proposal, this.prisma);
    const updated = await this.prisma.changeProposal.updateMany({
      where: {
        id,
        userId,
        proposalVersion: proposal.proposalVersion,
        status: { in: ["DRAFT", "READY", "BLOCKED"] },
      },
      data: {
        status: blockers.length ? "BLOCKED" : "READY",
        validationPassed: blockers.length === 0,
        validationBlockers: blockers,
        validationWarnings: [],
      },
    });
    if (!updated.count)
      throw new ConflictException({
        code: "PROPOSAL_VERSION_CONFLICT",
        message: "提案已改变",
      });
    return this.get(userId, id);
  }

  async apply(
    userId: string,
    id: string,
    expectedBaseVersion: number,
    key: string,
  ) {
    if (!key)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少幂等键",
      });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const proposal = await tx.changeProposal.findFirst({
        where: { id, userId, proposalType: "PLAN_RESTORE" },
      });
      if (!proposal)
        throw new NotFoundException({
          code: "PROPOSAL_NOT_FOUND",
          message: "恢复提案不存在",
        });
      const draft = proposal.draft as unknown as RestoreDraft;
      if (proposal.appliedVersionId) {
        const applied = await tx.planVersion.findUniqueOrThrow({
          where: { id: proposal.appliedVersionId },
        });
        return this.result(applied.versionNo, draft);
      }
      if (proposal.status !== "READY" || !proposal.validationPassed)
        throw new ConflictException({
          code: "PROPOSAL_NOT_READY",
          message: "恢复提案未通过校验",
        });
      const used = await tx.changeProposal.findUnique({
        where: { idempotencyKey: key },
        select: { id: true },
      });
      if (used && used.id !== id)
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "幂等键已被使用",
        });
      const plan = await tx.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: { include: { workouts: true } } },
      });
      if (
        !plan?.activeVersion ||
        plan.activeVersion.id !== proposal.baseVersionId ||
        plan.activeVersion.versionNo !== expectedBaseVersion
      )
        throw new ConflictException({
          code: "PLAN_VERSION_CONFLICT",
          message: "计划版本已改变",
        });
      const blockers = await this.check(proposal, tx);
      if (blockers.length)
        throw new ConflictException({
          code: "PROPOSAL_VALIDATION_FAILED",
          message: blockers.join("；"),
        });
      const version = await tx.planVersion.create({
        data: {
          planId: plan.id,
          versionNo: plan.activeVersion.versionNo + 1,
          baseVersionId: plan.activeVersion.id,
          changeReason: `RESTORE_FROM_${draft.targetVersionNo}`,
          appliedAt: new Date(),
        },
      });
      const replacing = new Set(draft.replaceWorkoutIds);
      for (const item of plan.activeVersion.workouts.filter(
        (item) => !replacing.has(item.id),
      ))
        await this.copy(tx, version.id, this.toStored(item));
      for (const item of draft.workouts) await this.copy(tx, version.id, item);
      const switched = await tx.trainingPlan.updateMany({
        where: { id: plan.id, userId, activeVersionId: plan.activeVersion.id },
        data: { activeVersionId: version.id },
      });
      if (!switched.count)
        throw new ConflictException({
          code: "PLAN_VERSION_CONFLICT",
          message: "计划版本已改变",
        });
      const updated = await tx.changeProposal.updateMany({
        where: {
          id,
          userId,
          status: "READY",
          proposalVersion: proposal.proposalVersion,
        },
        data: {
          status: "APPLIED",
          appliedVersionId: version.id,
          idempotencyKey: key,
        },
      });
      if (!updated.count)
        throw new ConflictException({
          code: "PROPOSAL_VERSION_CONFLICT",
          message: "提案已改变",
        });
      return this.result(version.versionNo, draft);
    });
  }

  private async check(
    proposal: ChangeProposal,
    tx: Prisma.TransactionClient | PrismaService,
  ) {
    const draft = proposal.draft as unknown as RestoreDraft;
    const blockers: string[] = [];
    const user = await tx.user.findUniqueOrThrow({
      where: { id: proposal.userId },
      select: { timezone: true },
    });
    const today = this.today(user.timezone);
    const ftp = await tx.abilityMeasurement.findFirst({
      where: { userId: proposal.userId, metricType: "FTP", unit: "W" },
      orderBy: { measuredAt: "desc" },
    });
    const plan = await tx.trainingPlan.findFirst({
      where: { userId: proposal.userId, status: "ACTIVE" },
      include: { activeVersion: { include: { workouts: true } } },
    });
    if (
      !plan?.activeVersion ||
      plan.activeVersion.id !== proposal.baseVersionId
    )
      blockers.push("计划版本已变化");
    const currentIds = new Set(
      plan?.activeVersion?.workouts.map((item) => item.id) ?? [],
    );
    if (draft.replaceWorkoutIds.some((id) => !currentIds.has(id)))
      blockers.push("原课程已变化");
    const recorded = await workoutActivities(
      tx,
      proposal.userId,
      (plan?.activeVersion?.workouts ?? []).filter((item) =>
        draft.replaceWorkoutIds.includes(item.id),
      ),
    );
    if (recorded.size) blockers.push("已有训练记录的课程不可恢复覆盖");
    const recordedDates = await tx.trainingActivity.findMany({
      where: {
        userId: proposal.userId,
        localDate: {
          in: draft.workouts.map((item) => dateToDb(item.scheduledDate)),
        },
      },
      select: { localDate: true },
    });
    if (recordedDates.length) blockers.push("恢复日期已有实际训练记录");
    const races = await tx.trainingRace.findMany({
      where: { userId: proposal.userId, status: "CONFIRMED" },
    });
    const assessments = await tx.trainingAssessment.findMany({
      where: { userId: proposal.userId, status: "SCHEDULED" },
    });
    const forbidden = new Set(
      [...races, ...assessments].map((item) => dbToDate(item.localDate)),
    );
    const availability = await tx.trainingAvailability.findUnique({
      where: { userId: proposal.userId },
    });
    const allowedMinutes = new Map(
      (
        (availability?.weekdays as
          { weekday: number; availableMinutes: number }[] | undefined) ?? []
      ).map((slot) => [slot.weekday, slot.availableMinutes]),
    );
    const totalsByDate = new Map<string, number>();
    for (const item of draft.workouts) {
      if (item.scheduledDate < today || forbidden.has(item.scheduledDate)) {
        blockers.push(`日期 ${item.scheduledDate} 已不可恢复`);
        continue;
      }
      const parsed = manualWorkoutDraftSchema.safeParse(item);
      if (!parsed.success) {
        blockers.push(`课程 ${item.scheduledDate} 结构无效`);
        continue;
      }
      try {
        const totals = validateDraft(
          parsed.data,
          Boolean(ftp && Number(ftp.value) > 0),
        );
        const weekday = new Date(
          `${item.scheduledDate}T00:00:00.000Z`,
        ).getUTCDay();
        const allowed = allowedMinutes.get(weekday);
        if (!allowed) blockers.push(`课程 ${item.scheduledDate} 不在可训练日`);
        if (totals.timeTargetMinutes) {
          totalsByDate.set(
            item.scheduledDate,
            (totalsByDate.get(item.scheduledDate) ?? 0) +
              totals.timeTargetMinutes,
          );
          if (
            totals.timeTargetMinutes > (availability?.maxSessionMinutes ?? 0) ||
            (totalsByDate.get(item.scheduledDate) ?? 0) > (allowed ?? 0)
          )
            blockers.push(`课程 ${item.scheduledDate} 超出可训练时长`);
        }
      } catch {
        blockers.push(`课程 ${item.scheduledDate} 强度无效`);
      }
    }
    return blockers;
  }

  private async copy(
    tx: Prisma.TransactionClient,
    planVersionId: string,
    item: StoredWorkout,
  ) {
    const parsed = manualWorkoutDraftSchema.parse(item);
    const totals = validateDraft(parsed, true);
    const workout = await tx.workout.create({
      data: {
        planVersionId,
        sportType: "cycling",
        purpose: item.purpose,
        title: item.title,
        scheduledDate: dateToDb(item.scheduledDate),
        dayOrder: item.dayOrder,
        timeTargetMin: totals.timeTargetMinutes,
        distanceTargetKm: totals.distanceTargetKm,
        source: item.source,
        structure: {
          segments: parsed.segments,
          ...(item.activityWorkoutId
            ? { activityWorkoutId: item.activityWorkoutId }
            : {}),
        },
      },
    });
    await tx.planItem.create({
      data: {
        planVersionId,
        eventType: "WORKOUT",
        scheduledDate: workout.scheduledDate,
        dayOrder: workout.dayOrder,
        workoutId: workout.id,
      },
    });
  }

  private toStored(item: Workout): StoredWorkout {
    return {
      activityWorkoutId: activityWorkoutId(item),
      scheduledDate: dbToDate(item.scheduledDate),
      dayOrder: item.dayOrder,
      title: item.title,
      purpose: item.purpose,
      source: item.source,
      segments: (item.structure as { segments: unknown }).segments,
    };
  }
  private today(timezone: string) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  private result(newPlanVersion: number, draft: RestoreDraft) {
    return {
      success: true as const,
      newPlanVersion,
      affectedDates: [
        ...new Set(draft.workouts.map((item) => item.scheduledDate)),
      ].sort(),
    };
  }
  private async find(userId: string, id: string) {
    const item = await this.prisma.changeProposal.findFirst({
      where: { id, userId, proposalType: "PLAN_RESTORE" },
    });
    if (!item)
      throw new NotFoundException({
        code: "PROPOSAL_NOT_FOUND",
        message: "恢复提案不存在",
      });
    return item;
  }
}
