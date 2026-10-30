import {
  copiedWorkoutStructure,
  workoutActivities,
} from "../training/workout-activity";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  aiProposalResponseSchema,
  aiWeekOutputSchema,
  type AiWeekOutput,
  type UpdateAiProposal,
} from "@ridepilot/contracts";
import type {
  Prisma,
  ChangeProposal,
  Workout,
} from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import {
  dateToDb,
  dbToDate,
  validateDraft,
} from "../training/training.validation";
import {
  CoachPlanValidator,
  type WeeklyAvailabilitySlot,
} from "./coach-plan.validator";

interface AiDraft extends AiWeekOutput {
  weekStartDate: string;
  endDate?: string;
  stageId?: string;
  replacedWorkouts?: { id: string; scheduledDate: string; title: string }[];
  scene:
    | "WEEK_PLAN"
    | "RANGE_PLAN"
    | "WORKOUT_ADJUST"
    | "PLAN_ADJUST"
    | "ASSESSMENT_REVIEW"
    | "RACE_REPLAN";
  mode: "initial" | "empty_week" | "replace_week" | "replace_workout" | "range";
  replaceWorkoutIds: string[];
  goalId: string;
  goalVersion: number;
  ftpMeasurementId: string;
  availabilityVersion: number;
  profileVersion: number;
  skillVersion: string;
  skillHash: string;
  model: string;
  relatedId?: string;
  relatedVersion?: number;
}

@Injectable()
export class CoachProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: CoachPlanValidator,
  ) {}

  isAiProposal(type: string) {
    return [
      "AI_WEEK_PLAN",
      "AI_WORKOUT_ADJUST",
      "AI_PLAN_ADJUST",
      "AI_ASSESSMENT_REVIEW",
      "AI_RACE_REPLAN",
    ].includes(type);
  }

  async get(userId: string, id: string) {
    const proposal = await this.find(userId, id);
    const draft = proposal.draft as unknown as AiDraft;
    const version = proposal.baseVersionId
      ? await this.prisma.planVersion.findUnique({
          where: { id: proposal.baseVersionId },
          select: { versionNo: true },
        })
      : null;
    return aiProposalResponseSchema.parse({
      proposalId: proposal.id,
      status: proposal.status,
      proposalVersion: proposal.proposalVersion,
      basePlanVersion: version?.versionNo ?? 0,
      scene: draft.scene,
      replaceWorkoutIds: draft.replaceWorkoutIds,
      weekStartDate: draft.weekStartDate,
      ...(draft.endDate ? { endDate: draft.endDate } : {}),
      ...(draft.stageId ? { stageId: draft.stageId } : {}),
      ...(draft.replacedWorkouts
        ? { replacedWorkouts: draft.replacedWorkouts }
        : {}),
      summary: draft.summary,
      stageSummary: draft.stageSummary,
      assessmentSuggestion: draft.assessmentSuggestion,
      workouts: draft.workouts,
      warnings: proposal.validationWarnings ?? [],
      blockers: proposal.validationBlockers ?? [],
      skillVersion: draft.skillVersion,
      model: draft.model,
    });
  }

  async update(userId: string, id: string, input: UpdateAiProposal) {
    const proposal = await this.find(userId, id);
    if (!["DRAFT", "READY", "BLOCKED"].includes(proposal.status))
      throw new ConflictException({
        code: "PROPOSAL_NOT_EDITABLE",
        message: "草稿不可编辑",
      });
    if (proposal.proposalVersion !== input.expectedProposalVersion)
      throw new ConflictException({
        code: "PROPOSAL_VERSION_CONFLICT",
        message: "草稿版本已改变",
      });
    const current = proposal.draft as unknown as AiDraft;
    const updated = await this.prisma.changeProposal.updateMany({
      where: {
        id,
        userId,
        proposalVersion: input.expectedProposalVersion,
        status: { in: ["DRAFT", "READY", "BLOCKED"] },
      },
      data: {
        draft: { ...current, ...input.draft },
        proposalVersion: { increment: 1 },
        status: "DRAFT",
        validationPassed: null,
        validationWarnings: [],
        validationBlockers: [],
      },
    });
    if (!updated.count)
      throw new ConflictException({
        code: "PROPOSAL_VERSION_CONFLICT",
        message: "草稿版本已改变",
      });
    return this.get(userId, id);
  }

  async validate(userId: string, id: string) {
    const proposal = await this.find(userId, id);
    if (!["DRAFT", "READY", "BLOCKED"].includes(proposal.status))
      throw new ConflictException({
        code: "PROPOSAL_NOT_EDITABLE",
        message: "草稿不可校验",
      });
    const blockers = await this.check(proposal);
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
      },
    });
    if (!updated.count)
      throw new ConflictException({
        code: "PROPOSAL_VERSION_CONFLICT",
        message: "草稿版本已改变",
      });
    return this.get(userId, id);
  }

  async apply(
    userId: string,
    id: string,
    expectedBaseVersion: number,
    key: string,
  ) {
    if (!key || key.length > 255)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少有效幂等键",
      });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const proposal = await tx.changeProposal.findFirst({
        where: { id, userId },
      });
      if (proposal && !this.isAiProposal(proposal.proposalType))
        throw new NotFoundException({
          code: "PROPOSAL_NOT_FOUND",
          message: "草稿不存在",
        });
      if (!proposal)
        throw new NotFoundException({
          code: "PROPOSAL_NOT_FOUND",
          message: "草稿不存在",
        });
      if (proposal.appliedVersionId)
        return this.appliedResponse(tx, proposal.appliedVersionId, proposal);
      if (proposal.status !== "READY" || !proposal.validationPassed)
        throw new ConflictException({
          code: "PROPOSAL_NOT_READY",
          message: "草稿尚未通过校验",
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
      const base = plan?.activeVersion ?? null;
      if (
        (base?.id ?? null) !== proposal.baseVersionId ||
        (base?.versionNo ?? 0) !== expectedBaseVersion
      ) {
        throw new ConflictException({
          code: "PLAN_VERSION_CONFLICT",
          message: "正式计划已更新，请重新生成",
        });
      }
      const blockers = await this.check(proposal, tx);
      if (blockers.length)
        throw new ConflictException({
          code: "PROPOSAL_VALIDATION_FAILED",
          message: blockers.join("；"),
        });
      const draft = proposal.draft as unknown as AiDraft;
      const targetPlan =
        plan ??
        (await tx.trainingPlan.create({ data: { userId, status: "ACTIVE" } }));
      const version = await tx.planVersion.create({
        data: {
          planId: targetPlan.id,
          versionNo: (base?.versionNo ?? 0) + 1,
          baseVersionId: base?.id ?? null,
          changeReason: proposal.proposalType,
          appliedAt: new Date(),
        },
      });
      const replacing = new Set(draft.replaceWorkoutIds);
      for (const old of base?.workouts.filter(
        (item) => !replacing.has(item.id),
      ) ?? [])
        await this.copyWorkout(tx, version.id, old);
      const dayOrder = new Map<string, number>();
      for (const old of base?.workouts.filter(
        (item) => !replacing.has(item.id),
      ) ?? [])
        dayOrder.set(
          dbToDate(old.scheduledDate),
          Math.max(
            dayOrder.get(dbToDate(old.scheduledDate)) ?? 0,
            old.dayOrder,
          ),
        );
      for (const workout of draft.workouts) {
        const original =
          draft.mode === "replace_workout"
            ? base?.workouts.find(
                (item) =>
                  replacing.has(item.id) &&
                  dbToDate(item.scheduledDate) === workout.scheduledDate,
              )
            : undefined;
        const order =
          original?.dayOrder ?? (dayOrder.get(workout.scheduledDate) ?? 0) + 1;
        dayOrder.set(workout.scheduledDate, order);
        const totals = validateDraft(workout, true);
        const created = await tx.workout.create({
          data: {
            planVersionId: version.id,
            sportType: "cycling",
            title: workout.title,
            purpose: workout.purpose,
            scheduledDate: dateToDb(workout.scheduledDate),
            dayOrder: order,
            timeTargetMin: totals.timeTargetMinutes,
            distanceTargetKm: totals.distanceTargetKm,
            source: "ai",
            structure: { segments: workout.segments },
          },
        });
        await tx.planItem.create({
          data: {
            planVersionId: version.id,
            eventType: "WORKOUT",
            scheduledDate: created.scheduledDate,
            dayOrder: order,
            workoutId: created.id,
          },
        });
      }
      const switched = await tx.trainingPlan.updateMany({
        where: { id: targetPlan.id, userId, activeVersionId: base?.id ?? null },
        data: { activeVersionId: version.id },
      });
      if (!switched.count)
        throw new ConflictException({
          code: "PLAN_VERSION_CONFLICT",
          message: "正式计划已更新",
        });
      const applied = await tx.changeProposal.updateMany({
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
      if (!applied.count)
        throw new ConflictException({
          code: "PROPOSAL_VERSION_CONFLICT",
          message: "草稿已改变",
        });
      return {
        success: true as const,
        newPlanVersion: version.versionNo,
        affectedDates: [
          ...new Set([
            ...draft.workouts.map((workout) => workout.scheduledDate),
            ...(draft.replacedWorkouts ?? []).map((item) => item.scheduledDate),
          ]),
        ].sort(),
      };
    });
  }

  private async check(
    proposal: ChangeProposal,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string[]> {
    const draft = proposal.draft as unknown as AiDraft;
    const userId = proposal.userId;
    const [ftp, availability, goal, user, races, assessments] =
      await Promise.all([
        tx.abilityMeasurement.findFirst({
          where: { userId, metricType: "FTP", unit: "W" },
          orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
        }),
        tx.trainingAvailability.findUnique({ where: { userId } }),
        tx.trainingGoal.findFirst({
          where: { id: draft.goalId, userId, status: "ACTIVE" },
        }),
        tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { profileVersion: true, timezone: true },
        }),
        tx.trainingRace.findMany({ where: { userId, status: "CONFIRMED" } }),
        tx.trainingAssessment.findMany({
          where: { userId, status: "SCHEDULED" },
        }),
      ]);
    const blockers: string[] = [];
    if (draft.stageId) {
      const stage = await tx.trainingStage.findFirst({
        where: {
          id: draft.stageId,
          stagePlan: {
            userId,
            goalId: draft.goalId,
            status: "ACTIVE",
            goalVersion: draft.goalVersion,
          },
        },
      });
      if (
        !stage ||
        dbToDate(stage.startDate) !== draft.weekStartDate ||
        dbToDate(stage.endDate) !== draft.endDate
      )
        blockers.push("阶段安排已变化，请重新生成");
    }
    if (!ftp || ftp.id !== draft.ftpMeasurementId)
      blockers.push("FTP 已变化，请重新生成");
    if (!availability || availability.version !== draft.availabilityVersion)
      blockers.push("可训练时间已变化，请重新生成");
    if (!goal) blockers.push("训练目标已变化，请重新生成");
    else if (goal.version !== draft.goalVersion)
      blockers.push("训练目标已变化，请重新生成");
    if (user.profileVersion !== draft.profileVersion)
      blockers.push("运动档案已变化，请重新生成");
    if (blockers.length || !ftp || !availability) return blockers;
    if (draft.relatedId && draft.relatedVersion !== undefined) {
      const related =
        draft.scene === "RACE_REPLAN"
          ? await tx.trainingRace.findFirst({
              where: { id: draft.relatedId, userId },
              select: { version: true },
            })
          : await tx.trainingAssessment.findFirst({
              where: { id: draft.relatedId, userId },
              select: { version: true },
            });
      if (!related || related.version !== draft.relatedVersion)
        blockers.push("关联赛事或测试已变化，请重新生成");
    }
    const plan = await tx.trainingPlan.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { activeVersion: { include: { workouts: true } } },
    });
    const activeIds = new Set(
      plan?.activeVersion?.workouts.map((item) => item.id) ?? [],
    );
    if (draft.replaceWorkoutIds.some((id) => !activeIds.has(id)))
      blockers.push("受影响课程已变化，请重新生成");
    if (draft.replaceWorkoutIds.length) {
      const recorded = await workoutActivities(
        tx,
        userId,
        (plan?.activeVersion?.workouts ?? []).filter((item) =>
          draft.replaceWorkoutIds.includes(item.id),
        ),
      );
      if (recorded.size) blockers.push("课程已有实际训练记录，不可覆盖");
    }
    if (
      draft.mode === "replace_workout" &&
      (draft.workouts.length !== 1 || draft.replaceWorkoutIds.length !== 1)
    )
      blockers.push("单节调整只能生成一节课程");
    if (blockers.length) return blockers;
    const retainedMinutes = Object.fromEntries(
      (plan?.activeVersion?.workouts ?? [])
        .filter((item) => !draft.replaceWorkoutIds.includes(item.id))
        .reduce((entries, item) => {
          const date = dbToDate(item.scheduledDate);
          entries.set(
            date,
            (entries.get(date) ?? 0) +
              (item.timeTargetMin ? Number(item.timeTargetMin) : 0),
          );
          return entries;
        }, new Map<string, number>()),
    );
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const weekStart = new Date(`${draft.weekStartDate}T00:00:00.000Z`);
    const forbiddenDates = [...races, ...assessments].map((item) =>
      dbToDate(item.localDate),
    );
    for (
      let day = new Date(weekStart);
      day.toISOString().slice(0, 10) < today &&
      day.getTime() <=
        (draft.endDate
          ? Date.parse(draft.endDate)
          : weekStart.getTime() + 6 * 86_400_000);
      day = new Date(day.getTime() + 86_400_000)
    )
      forbiddenDates.push(day.toISOString().slice(0, 10));
    try {
      this.validator.validate(
        aiWeekOutputSchema.parse({
          summary: draft.summary,
          workouts: draft.workouts,
          stageSummary: draft.stageSummary,
          assessmentSuggestion: draft.assessmentSuggestion,
        }),
        {
          weekStartDate: draft.weekStartDate,
          ...(draft.endDate ? { endDate: draft.endDate } : {}),
          ftpWatts: Number(ftp.value),
          weekdays:
            availability.weekdays as unknown as WeeklyAvailabilitySlot[],
          maxSessionMinutes: availability.maxSessionMinutes,
          forbiddenDates,
          retainedMinutes,
        },
      );
    } catch (error) {
      if (error instanceof BadRequestException) blockers.push(error.message);
      else blockers.push("草稿结构无效");
    }
    return blockers;
  }

  private async copyWorkout(
    tx: Prisma.TransactionClient,
    versionId: string,
    old: Workout,
  ) {
    const copy = await tx.workout.create({
      data: {
        planVersionId: versionId,
        sportType: old.sportType,
        purpose: old.purpose,
        title: old.title,
        scheduledDate: old.scheduledDate,
        dayOrder: old.dayOrder,
        timeTargetMin: old.timeTargetMin,
        distanceTargetKm: old.distanceTargetKm,
        source: old.source,
        structure: copiedWorkoutStructure(old),
      },
    });
    await tx.planItem.create({
      data: {
        planVersionId: versionId,
        eventType: "WORKOUT",
        scheduledDate: copy.scheduledDate,
        dayOrder: copy.dayOrder,
        workoutId: copy.id,
      },
    });
  }

  private async appliedResponse(
    tx: Prisma.TransactionClient,
    versionId: string,
    proposal: ChangeProposal,
  ) {
    const version = await tx.planVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    const draft = proposal.draft as unknown as AiDraft;
    return {
      success: true as const,
      newPlanVersion: version.versionNo,
      affectedDates: [
        ...new Set([
          ...draft.workouts.map((item) => item.scheduledDate),
          ...(draft.replacedWorkouts ?? []).map((item) => item.scheduledDate),
        ]),
      ].sort(),
    };
  }

  private async find(userId: string, id: string) {
    const proposal = await this.prisma.changeProposal.findFirst({
      where: { id, userId },
    });
    if (!proposal || !this.isAiProposal(proposal.proposalType))
      throw new NotFoundException({
        code: "PROPOSAL_NOT_FOUND",
        message: "草稿不存在",
      });
    return proposal;
  }
}
