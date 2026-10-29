import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApplyNutritionProposal,
  ApplyNutritionProposalResponse,
  CreateNutritionMealSwapProposal,
  CreateNutritionPlanProposal,
  NutritionPlanDraft,
  NutritionProposalResponse,
  UpdateNutritionProposal,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dateToDb, dbToDate } from "../training/training.validation";
import {
  toPlanDraft,
  toProfileResponse,
  toProposalResponse,
} from "./nutrition.mapper";
import { NutritionRepository } from "./nutrition.repository";
import { validateNutritionDraft } from "./nutrition.validation";

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class NutritionProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: NutritionRepository,
  ) {}

  async createPlanProposal(
    userId: string,
    input: CreateNutritionPlanProposal,
    idempotencyKey?: string,
  ): Promise<NutritionProposalResponse> {
    const existing = await this.findByKey(userId, idempotencyKey);
    if (existing) return toProposalResponse(existing);
    const profile = await this.repository.findProfile(userId);
    if (!profile) throw this.profileRequired();
    const plan = await this.repository.findActivePlan(userId);
    const baseVersion = plan?.activeVersion ?? null;
    this.assertExpectedVersion(
      input.expectedNutritionVersion,
      baseVersion?.versionNo ?? 0,
    );
    const proposal = await this.prisma.nutritionProposal.create({
      data: {
        userId,
        planId: plan?.id,
        baseVersionId: baseVersion?.id,
        proposalType: "PLAN_CREATE",
        draft: json(input.draft),
        original: baseVersion
          ? json(
              toPlanDraft(
                baseVersion.items,
                this.snapshotDate(baseVersion.snapshot, "startDate") ??
                  dbToDate(baseVersion.items[0]?.localDate ?? new Date()),
                this.snapshotDate(baseVersion.snapshot, "endDate") ??
                  dbToDate(baseVersion.items.at(-1)?.localDate ?? new Date()),
                (baseVersion.snapshot as { dailyTarget?: unknown } | null)
                  ?.dailyTarget ?? null,
              ),
            )
          : undefined,
        idempotencyKey,
      },
      include: { baseVersion: true },
    });
    return toProposalResponse(proposal);
  }

  async createMealSwapProposal(
    userId: string,
    input: CreateNutritionMealSwapProposal,
    idempotencyKey?: string,
  ): Promise<NutritionProposalResponse> {
    const existing = await this.findByKey(userId, idempotencyKey);
    if (existing) return toProposalResponse(existing);
    const item = await this.repository.findPlanItem(userId, input.itemId);
    if (
      !item?.planVersion.plan ||
      item.planVersion.plan.activeVersionId !== item.planVersionId
    )
      throw new NotFoundException({
        code: "NUTRITION_ITEM_NOT_FOUND",
        message: "餐次不存在",
      });
    this.assertExpectedVersion(
      input.expectedNutritionVersion,
      item.planVersion.versionNo,
    );
    const profile = await this.repository.findProfile(userId);
    if (!profile) throw this.profileRequired();
    const dates = item.planVersion.items
      .map((entry) => dbToDate(entry.localDate))
      .sort();
    const current = toPlanDraft(
      item.planVersion.items,
      dates[0],
      dates.at(-1) ?? dates[0],
      (item.planVersion.snapshot as { dailyTarget?: unknown } | null)
        ?.dailyTarget ?? null,
    );
    const draft: NutritionPlanDraft = {
      ...current,
      items: current.items.map((entry) =>
        entry.localDate === dbToDate(item.localDate) &&
        entry.mealType === item.mealType &&
        entry.scheduledLocalTime === item.scheduledLocalTime
          ? input.replacement
          : entry,
      ),
    };
    const proposal = await this.prisma.nutritionProposal.create({
      data: {
        userId,
        planId: item.planVersion.plan.id,
        baseVersionId: item.planVersionId,
        proposalType: "MEAL_SWAP",
        draft: json(draft),
        original: json(current),
        idempotencyKey,
      },
      include: { baseVersion: true },
    });
    return toProposalResponse(proposal);
  }

  async get(
    userId: string,
    proposalId: string,
  ): Promise<NutritionProposalResponse> {
    const proposal = await this.repository.findProposal(userId, proposalId);
    if (!proposal) throw this.notFound();
    return toProposalResponse(proposal);
  }

  async update(
    userId: string,
    proposalId: string,
    input: UpdateNutritionProposal,
  ) {
    const proposal = await this.repository.findProposal(userId, proposalId);
    if (!proposal) throw this.notFound();
    if (!["DRAFT", "READY", "BLOCKED"].includes(proposal.status))
      throw new ConflictException({
        code: "PROPOSAL_NOT_EDITABLE",
        message: "当前营养草稿不可编辑",
      });
    if (proposal.proposalVersion !== input.expectedProposalVersion)
      throw this.proposalVersionConflict();
    const updated = await this.prisma.nutritionProposal.updateMany({
      where: {
        id: proposalId,
        userId,
        proposalVersion: input.expectedProposalVersion,
        status: { in: ["DRAFT", "READY", "BLOCKED"] },
      },
      data: {
        draft: json(input.draft),
        proposalVersion: { increment: 1 },
        status: "DRAFT",
        validationPassed: null,
        validationWarnings: [],
        validationBlockers: [],
      },
    });
    if (!updated.count) throw this.proposalVersionConflict();
    return this.get(userId, proposalId);
  }

  async validate(userId: string, proposalId: string) {
    const proposal = await this.repository.findProposal(userId, proposalId);
    if (!proposal) throw this.notFound();
    if (!["DRAFT", "READY", "BLOCKED"].includes(proposal.status))
      throw new ConflictException({
        code: "PROPOSAL_NOT_EDITABLE",
        message: "当前营养草稿不可校验",
      });
    const profile = await this.repository.findProfile(userId);
    if (!profile) throw this.profileRequired();
    const result = validateNutritionDraft(
      proposal.draft as unknown as NutritionPlanDraft,
      toProfileResponse(profile),
    );
    await this.prisma.nutritionProposal.updateMany({
      where: {
        id: proposalId,
        userId,
        proposalVersion: proposal.proposalVersion,
        status: { in: ["DRAFT", "READY", "BLOCKED"] },
      },
      data: {
        status: result.blockers.length ? "BLOCKED" : "READY",
        validationPassed: result.blockers.length === 0,
        validationWarnings: json(result.warnings),
        validationBlockers: json(result.blockers),
      },
    });
    return this.get(userId, proposalId);
  }

  async apply(
    userId: string,
    proposalId: string,
    input: ApplyNutritionProposal,
    idempotencyKey?: string,
  ): Promise<ApplyNutritionProposalResponse> {
    if (!idempotencyKey || idempotencyKey.length > 255)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少有效幂等键",
      });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const proposal = await tx.nutritionProposal.findFirst({
        where: { id: proposalId, userId },
        include: { baseVersion: true },
      });
      if (!proposal) throw this.notFound();
      if (proposal.appliedVersionId)
        return this.appliedResponse(tx, proposal.appliedVersionId);
      const used = await tx.nutritionProposal.findUnique({
        where: { applyIdempotencyKey: idempotencyKey },
        select: { id: true },
      });
      if (used && used.id !== proposalId)
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "幂等键已被其他提案使用",
        });
      if (proposal.status !== "READY" || !proposal.validationPassed)
        throw new ConflictException({
          code: "NUTRITION_PROPOSAL_NOT_READY",
          message: "营养草稿尚未通过校验",
        });
      const plan = await tx.nutritionPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: true },
      });
      this.assertExpectedVersion(
        input.expectedNutritionVersion,
        plan?.activeVersion?.versionNo ?? 0,
      );
      if (
        (proposal.baseVersionId ?? null) !== (plan?.activeVersion?.id ?? null)
      )
        throw new ConflictException({
          code: "NUTRITION_VERSION_CONFLICT",
          message: "营养草稿基于旧版本，请重新生成",
        });
      const profile = await tx.nutritionProfile.findUnique({
        where: { userId },
      });
      if (!profile) throw this.profileRequired();
      const result = validateNutritionDraft(
        proposal.draft as unknown as NutritionPlanDraft,
        toProfileResponse(profile),
      );
      if (result.blockers.length)
        throw new ConflictException({
          code: "NUTRITION_VALIDATION_FAILED",
          message: result.blockers.join("；"),
        });
      const targetPlan =
        plan ??
        (await tx.nutritionPlan.create({ data: { userId, status: "ACTIVE" } }));
      const draft = proposal.draft as unknown as NutritionPlanDraft;
      const version = await tx.nutritionPlanVersion.create({
        data: {
          planId: targetPlan.id,
          versionNo: (plan?.activeVersion?.versionNo ?? 0) + 1,
          baseVersionId: plan?.activeVersion?.id,
          source: proposal.proposalType,
          profileVersion: profile.version,
          snapshot: json({
            dailyTarget: draft.dailyTarget ?? null,
            startDate: draft.startDate,
            endDate: draft.endDate,
          }),
          appliedAt: new Date(),
        },
      });
      await tx.nutritionItem.createMany({
        data: draft.items.map((item) => ({
          planVersionId: version.id,
          localDate: dateToDb(item.localDate),
          mealType: item.mealType,
          scheduledLocalTime: item.scheduledLocalTime,
          title: item.title,
          foods: json(item.foods),
          nutrients: json(item.nutrients),
          nutritionSource: item.nutritionSource,
          confidence: item.confidence,
          linkedWorkoutId: item.linkedWorkoutId,
          notes: item.notes ?? null,
        })),
      });
      await tx.nutritionPlan.update({
        where: { id: targetPlan.id },
        data: { activeVersionId: version.id },
      });
      await tx.nutritionProposal.update({
        where: { id: proposalId },
        data: {
          status: "APPLIED",
          appliedVersionId: version.id,
          applyIdempotencyKey: idempotencyKey,
        },
      });
      return {
        success: true as const,
        newNutritionVersion: version.versionNo,
        affectedDates: [
          ...new Set(draft.items.map((item) => item.localDate)),
        ].sort(),
      };
    });
  }

  private async appliedResponse(
    tx: Prisma.TransactionClient,
    versionId: string,
  ) {
    const version = await tx.nutritionPlanVersion.findUnique({
      where: { id: versionId },
      include: { items: true },
    });
    if (!version)
      throw new ConflictException({
        code: "NUTRITION_VERSION_NOT_FOUND",
        message: "营养计划版本不存在",
      });
    return {
      success: true as const,
      newNutritionVersion: version.versionNo,
      affectedDates: [
        ...new Set(version.items.map((item) => dbToDate(item.localDate))),
      ].sort(),
    };
  }

  private snapshotDate(snapshot: unknown, key: "startDate" | "endDate") {
    const value = (snapshot as Record<string, unknown> | null)?.[key];
    return typeof value === "string" ? value : null;
  }

  private async findByKey(userId: string, key?: string) {
    if (!key) return null;
    const existing = await this.repository.findProposalByCreateKey(userId, key);
    if (existing) return this.repository.findProposal(userId, existing.id);
    const used = await this.prisma.nutritionProposal.findUnique({
      where: { idempotencyKey: key },
      select: { userId: true },
    });
    if (used && used.userId !== userId)
      throw new ConflictException({
        code: "IDEMPOTENCY_KEY_CONFLICT",
        message: "幂等键已被其他用户使用",
      });
    return null;
  }

  private assertExpectedVersion(expected: number | undefined, actual: number) {
    if (actual > 0 && expected === undefined)
      throw new ConflictException({
        code: "NUTRITION_VERSION_REQUIRED",
        message: "操作已有营养计划时必须提供 expectedNutritionVersion",
      });
    if (expected !== undefined && expected !== actual)
      throw new ConflictException({
        code: "NUTRITION_VERSION_CONFLICT",
        message: "正式营养计划已更新，请重新生成草稿",
      });
  }

  private profileRequired() {
    return new ConflictException({
      code: "NUTRITION_PROFILE_REQUIRED",
      message: "请先建立饮食档案",
    });
  }

  private notFound() {
    return new NotFoundException({
      code: "NUTRITION_PROPOSAL_NOT_FOUND",
      message: "营养提案不存在",
    });
  }

  private proposalVersionConflict() {
    return new ConflictException({
      code: "PROPOSAL_VERSION_CONFLICT",
      message: "营养草稿已被其他请求修改，请重新读取",
    });
  }
}
