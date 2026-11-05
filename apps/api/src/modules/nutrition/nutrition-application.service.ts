import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type ApplyNutritionProposal,
  type ApplyNutritionProposalResponse,
  type NutritionPlanDraft,
  nutritionProposalMetadataSchema,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dbToDate, dateToDb } from "../training/training.validation";
import { toItemDraft, toProfileResponse } from "./nutrition.mapper";
import { validateNutritionDraft } from "./nutrition.validation";
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class NutritionApplicationService {
  constructor(private readonly prisma: PrismaService) {}
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
      await tx.$queryRaw`SELECT "id" FROM "nutrition_proposals" WHERE "id" = ${proposalId}::uuid AND "user_id" = ${userId}::uuid FOR UPDATE`;
      const proposal = await tx.nutritionProposal.findFirst({
        where: { id: proposalId, userId },
        include: { baseVersion: true },
      });
      if (!proposal) throw this.notFound();
      if (proposal.appliedVersionId)
        return this.appliedResponse(tx, proposal.appliedVersionId);
      if (
        input.expectedProposalVersion !== undefined &&
        proposal.proposalVersion !== input.expectedProposalVersion
      )
        throw new ConflictException({
          code: "PROPOSAL_VERSION_CONFLICT",
          message: "草稿已变化，请重新预览和校验",
        });
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
        include: { activeVersion: { include: { items: true } } },
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
      const parsedMetadata = nutritionProposalMetadataSchema.safeParse(
        proposal.metadata,
      );
      const trainingContext = parsedMetadata.success
        ? parsedMetadata.data.trainingContext
        : undefined;
      if (trainingContext?.trainingProposalId) {
        const source = await tx.changeProposal.findFirst({
          where: { id: trainingContext.trainingProposalId, userId },
        });
        if (
          !source ||
          source.status !== "APPLIED" ||
          source.appliedVersionId !== trainingContext.planVersionId
        )
          throw new ConflictException({
            code: "TRAINING_PROPOSAL_NOT_APPLIED",
            message: "请先应用训练调整，再按最新训练重新生成补给草稿",
          });
      }
      if (trainingContext) {
        const training = await tx.trainingPlan.findFirst({
          where: { userId, status: "ACTIVE" },
        });
        if (
          (training?.activeVersionId ?? null) !== trainingContext.planVersionId
        )
          throw new ConflictException({
            code: "PLAN_VERSION_CONFLICT",
            message: "训练计划已更新，请重新生成联动补给草稿",
          });
      }
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
      const previousSnapshot = plan?.activeVersion?.snapshot as {
        trainingDateSignatures?: Record<string, string>;
        dailyTargets?: Record<string, unknown>;
        dailyTarget?: unknown;
      } | null;
      const outsideItems = (plan?.activeVersion?.items ?? []).filter((item) => {
        const date = dbToDate(item.localDate);
        return date < draft.startDate || date > draft.endDate;
      });
      const allItems = [...outsideItems.map(toItemDraft), ...draft.items];
      const allDates = allItems.map((item) => item.localDate).sort();
      const dailyTargets = { ...previousSnapshot?.dailyTargets };
      const signatures = {
        ...previousSnapshot?.trainingDateSignatures,
        ...trainingContext?.dateSignatures,
      };
      const affectedDates: string[] = [];
      for (
        let day = dateToDb(draft.startDate);
        dbToDate(day) <= draft.endDate;
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        dailyTargets[dbToDate(day)] = draft.dailyTarget ?? null;
        affectedDates.push(dbToDate(day));
      }
      for (const item of outsideItems) {
        const date = dbToDate(item.localDate);
        if (!(date in dailyTargets))
          dailyTargets[date] = previousSnapshot?.dailyTarget ?? null;
      }
      const version = await tx.nutritionPlanVersion.create({
        data: {
          planId: targetPlan.id,
          versionNo: (plan?.activeVersion?.versionNo ?? 0) + 1,
          baseVersionId: plan?.activeVersion?.id,
          source: proposal.proposalType,
          profileVersion: profile.version,
          snapshot: json({
            dailyTarget: draft.dailyTarget ?? null,
            startDate: allDates[0] ?? draft.startDate,
            endDate: allDates.at(-1) ?? draft.endDate,
            affectedDates,
            trainingDateSignatures: signatures,
            dailyTargets,
          }),
          appliedAt: new Date(),
        },
      });
      await tx.nutritionItem.createMany({
        data: allItems.map((item) => ({
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
        affectedDates,
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
      affectedDates:
        (version.snapshot as { affectedDates?: string[] } | null)
          ?.affectedDates ??
        [
          ...new Set(version.items.map((item) => dbToDate(item.localDate))),
        ].sort(),
    };
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
}
