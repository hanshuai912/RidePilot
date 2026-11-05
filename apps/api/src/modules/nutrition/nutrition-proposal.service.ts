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
  CreateNutritionItemEdit,
  CreateNutritionPlanProposal,
  NutritionPlanDraft,
  NutritionProposalResponse,
  UpdateNutritionProposal,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dbToDate } from "../training/training.validation";
import {
  toPlanDraft,
  toProfileResponse,
  toProposalResponse,
} from "./nutrition.mapper";
import { NutritionApplicationService } from "./nutrition-application.service";
import { NutritionRepository } from "./nutrition.repository";
import { validateNutritionDraft } from "./nutrition.validation";

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class NutritionProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: NutritionRepository,
    private readonly application: NutritionApplicationService,
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
    const originals =
      baseVersion?.items.filter((item) => {
        const date = dbToDate(item.localDate);
        return date >= input.draft.startDate && date <= input.draft.endDate;
      }) ?? [];
    const proposal = await this.prisma.nutritionProposal.create({
      data: {
        userId,
        planId: plan?.id,
        baseVersionId: baseVersion?.id,
        proposalType: "PLAN_CREATE",
        draft: json(input.draft),
        original: originals.length
          ? json(
              toPlanDraft(
                originals,
                input.draft.startDate,
                input.draft.endDate,
                (baseVersion?.snapshot as { dailyTarget?: unknown } | null)
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

  async createItemEdit(
    userId: string,
    input: CreateNutritionItemEdit,
    key?: string,
  ) {
    const existing = await this.findByKey(userId, key);
    if (existing) return toProposalResponse(existing);
    const item = await this.repository.findPlanItem(userId, input.itemId);
    if (!item)
      throw new NotFoundException({
        code: "NUTRITION_ITEM_NOT_FOUND",
        message: "餐次不存在",
      });
    const draft = toPlanDraft(
      [item],
      dbToDate(item.localDate),
      dbToDate(item.localDate),
      null,
    ).items[0];
    if (draft.foods.length !== input.amounts.length)
      throw new BadRequestException({
        code: "NUTRITION_AMOUNTS_INVALID",
        message: "食物份量与餐次不匹配",
      });
    const changed = draft.foods.some(
      (food, index) => food.amount !== input.amounts[index],
    );
    return this.createMealSwapProposal(
      userId,
      {
        itemId: input.itemId,
        expectedNutritionVersion: input.expectedNutritionVersion,
        reason: "TRAINING_CHANGED",
        replacement: {
          ...draft,
          scheduledLocalTime: input.scheduledLocalTime,
          foods: draft.foods.map((food, index) => ({
            ...food,
            amount: input.amounts[index],
          })),
          ...(changed
            ? {
                nutrients: {
                  energyKcal: null,
                  carbohydrateG: null,
                  proteinG: null,
                  fatG: null,
                  fluidMl: null,
                  sodiumMg: null,
                },
                nutritionSource: "USER_ENTERED" as const,
                confidence: "LOW" as const,
              }
            : {}),
        },
      },
      key,
      "ITEM_EDIT",
    );
  }

  async createMealSwapProposal(
    userId: string,
    input: CreateNutritionMealSwapProposal,
    idempotencyKey?: string,
    proposalType: "MEAL_SWAP" | "ITEM_EDIT" = "MEAL_SWAP",
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
    const date = dbToDate(item.localDate);
    const dayItems = item.planVersion.items.filter(
      (entry) => dbToDate(entry.localDate) === date,
    );
    const snapshot = item.planVersion.snapshot as {
      dailyTarget?: unknown;
      dailyTargets?: Record<string, unknown>;
    } | null;
    const current = toPlanDraft(
      dayItems,
      date,
      date,
      (snapshot?.dailyTargets && date in snapshot.dailyTargets
        ? snapshot.dailyTargets[date]
        : snapshot?.dailyTarget) ?? null,
    );
    const draft: NutritionPlanDraft = {
      ...current,
      items: current.items.map((entry, index) =>
        dayItems[index].id === item.id ? input.replacement : entry,
      ),
    };
    const proposal = await this.prisma.nutritionProposal.create({
      data: {
        userId,
        planId: item.planVersion.plan.id,
        baseVersionId: item.planVersionId,
        proposalType,
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
    const previousDraft = proposal.draft as unknown as NutritionPlanDraft;
    if (
      input.draft.startDate !== previousDraft.startDate ||
      input.draft.endDate !== previousDraft.endDate
    )
      throw new BadRequestException({
        code: "NUTRITION_RANGE_CHANGED",
        message: "编辑草稿不能改变覆盖日期，请重新生成",
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

  apply(
    userId: string,
    proposalId: string,
    input: ApplyNutritionProposal,
    key?: string,
  ): Promise<ApplyNutritionProposalResponse> {
    return this.application.apply(userId, proposalId, input, key);
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
