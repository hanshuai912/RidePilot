import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  nutritionAiOutputSchema,
  nutritionGenerationInputSchema,
  NutritionGenerationInput,
} from "@ridepilot/contracts";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AiException } from "../../ai/exceptions/ai.exception";
import { AiService } from "../../ai/ai.service";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dbToDate, dateToDb } from "../training/training.validation";
import { toProfileResponse } from "./nutrition.mapper";
import { NutritionRepository } from "./nutrition.repository";
import { NutritionSkillLoaderService } from "./nutrition-skill-loader.service";
import { validateNutritionDraft } from "./nutrition.validation";

@Injectable()
export class NutritionGenerationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NutritionGenerationService.name);
  private timer?: NodeJS.Timeout;
  private working = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly skill: NutritionSkillLoaderService,
    private readonly repository: NutritionRepository,
  ) {}

  async onModuleInit() {
    try {
      await this.prisma.aiGeneration.findFirst({
        where: { scene: "NUTRITION_PLAN" },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      )
        return;
      throw error;
    }
    this.timer = setInterval(() => void this.tick(), 1_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async submit(userId: string, input: NutritionGenerationInput, key?: string) {
    if (!key || key.length > 255)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少有效幂等键",
      });
    const parsed = nutritionGenerationInputSchema.parse(input);
    const existing = await this.prisma.aiGeneration.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
    });
    if (existing) {
      const previous = nutritionGenerationInputSchema.parse(existing.input);
      if (
        existing.scene !== "NUTRITION_PLAN" ||
        JSON.stringify(previous) !== JSON.stringify(parsed)
      )
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "幂等键已用于不同请求",
        });
      return this.toResponse(existing);
    }
    await this.context(userId, parsed);
    try {
      const job = await this.prisma.aiGeneration.create({
        data: {
          userId,
          scene: "NUTRITION_PLAN",
          input: parsed,
          idempotencyKey: key,
          requestId: randomUUID(),
        },
      });
      return this.toResponse(job);
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      const raced = await this.prisma.aiGeneration.findUniqueOrThrow({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      const previous = nutritionGenerationInputSchema.parse(raced.input);
      if (
        raced.scene !== "NUTRITION_PLAN" ||
        JSON.stringify(previous) !== JSON.stringify(parsed)
      )
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "幂等键已用于不同请求",
        });
      return this.toResponse(raced);
    }
  }

  async get(userId: string, id: string) {
    const job = await this.prisma.aiGeneration.findFirst({
      where: { id, userId, scene: "NUTRITION_PLAN" },
    });
    if (!job)
      throw new NotFoundException({
        code: "GENERATION_NOT_FOUND",
        message: "营养生成任务不存在",
      });
    return this.toResponse(job);
  }

  private async tick() {
    if (this.working) return;
    this.working = true;
    try {
      const now = new Date();
      const candidate = await this.prisma.aiGeneration.findFirst({
        where: {
          scene: "NUTRITION_PLAN",
          OR: [
            { status: "QUEUED" },
            { status: "RUNNING", leaseUntil: { lt: now } },
          ],
        },
        orderBy: { createdAt: "asc" },
      });
      if (!candidate) return;
      if (candidate.attempts >= 2) {
        await this.prisma.aiGeneration.updateMany({
          where: {
            id: candidate.id,
            scene: "NUTRITION_PLAN",
            status: candidate.status,
          },
          data: {
            status: "FAILED",
            errorCode: "AI_RETRY_EXHAUSTED",
            leaseUntil: null,
          },
        });
        return;
      }
      const claimed = await this.prisma.aiGeneration.updateMany({
        where: {
          id: candidate.id,
          scene: "NUTRITION_PLAN",
          status: candidate.status,
          attempts: candidate.attempts,
        },
        data: {
          status: "RUNNING",
          attempts: { increment: 1 },
          leaseUntil: new Date(now.getTime() + 120_000),
        },
      });
      if (claimed.count) await this.process(candidate.id);
    } catch (error) {
      this.logger.error({
        stage: "nutrition-worker",
        code: this.errorCode(error),
      });
    } finally {
      this.working = false;
    }
  }

  private async process(jobId: string) {
    const job = await this.prisma.aiGeneration.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status !== "RUNNING") return;
    const input = nutritionGenerationInputSchema.parse(job.input);
    try {
      const context = await this.context(job.userId, input);
      const skill = await this.skill.load(input.mode);
      const response = await this.ai.generate({
        requestId: job.requestId ?? job.id,
        temperature: 0.2,
        maxTokens: 7000,
        metadata: {
          feature: "nutrition-plan",
          generationId: job.id,
          skillHash: skill.hash,
        },
        messages: [
          {
            role: "system",
            content:
              "You are the RidePilot sports nutrition draft generator. Return only complete JSON matching the supplied schema. Write all human-facing text in Simplified Chinese. Never invent missing measurements, never diagnose or prescribe clinical treatment, and never apply a plan.",
          },
          { role: "system", content: skill.content },
          {
            role: "user",
            content: JSON.stringify({
              task: "Generate a conservative cycling nutrition draft for the requested date range.",
              input,
              context,
              outputSchema: z.toJSONSchema(nutritionAiOutputSchema),
            }),
          },
        ],
      });
      const raw = JSON.parse(response.text) as unknown;
      const output = nutritionAiOutputSchema.parse(raw);
      const validation = validateNutritionDraft(
        output.draft,
        toProfileResponse(context.nutritionProfile),
      );
      const blockers = [
        ...new Set([...output.blockers, ...validation.blockers]),
      ];
      const warnings = [
        ...new Set([...output.warnings, ...validation.warnings]),
      ];
      const metadata = {
        summary: output.summary,
        assumptions: output.assumptions,
        warnings,
        blockers,
        sourceRefs: output.sourceRefs,
        confidence: output.confidence,
        model: response.model,
        skillVersion: skill.version,
        skillHash: skill.hash,
      };
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.aiGeneration.updateMany({
          where: {
            id: job.id,
            scene: "NUTRITION_PLAN",
            status: "RUNNING",
            attempts: job.attempts,
          },
          data: { leaseUntil: null },
        });
        if (!updated.count) return;
        const plan = await tx.nutritionPlan.findFirst({
          where: { userId: job.userId, status: "ACTIVE" },
          include: { activeVersion: true },
        });
        const proposal = await tx.nutritionProposal.create({
          data: {
            userId: job.userId,
            planId: plan?.id,
            baseVersionId: plan?.activeVersionId,
            proposalType: "AI_PLAN",
            status: blockers.length ? "BLOCKED" : "READY",
            draft: output.draft,
            metadata,
            validationPassed: blockers.length === 0,
            validationWarnings: warnings,
            validationBlockers: blockers,
          },
        });
        await tx.aiGeneration.update({
          where: { id: job.id },
          data: {
            status: "READY",
            proposalId: proposal.id,
            errorCode: null,
            leaseUntil: null,
          },
        });
      });
    } catch (error) {
      const code = this.errorCode(error);
      const retryable =
        job.attempts < 2 &&
        (error instanceof AiException || code === "AI_OUTPUT_INVALID");
      await this.prisma.aiGeneration.updateMany({
        where: {
          id: job.id,
          scene: "NUTRITION_PLAN",
          status: "RUNNING",
          attempts: job.attempts,
        },
        data: {
          status: retryable ? "QUEUED" : "FAILED",
          errorCode: code,
          leaseUntil: null,
        },
      });
      this.logger.warn({
        generationId: job.id,
        requestId: job.requestId,
        code,
        retryable,
      });
    }
  }

  private async context(userId: string, input: NutritionGenerationInput) {
    if (input.startDate > input.endDate)
      throw new BadRequestException({
        code: "NUTRITION_DATE_INVALID",
        message: "计划开始日期不能晚于结束日期",
      });
    const days =
      (dateToDb(input.endDate).getTime() -
        dateToDb(input.startDate).getTime()) /
        86_400_000 +
      1;
    if (days > 31)
      throw new BadRequestException({
        code: "NUTRITION_DATE_RANGE_TOO_LARGE",
        message: "一次最多生成 31 天饮食草稿",
      });
    const [
      nutritionProfile,
      athleteProfile,
      user,
      plan,
      nutritionPlan,
      workouts,
      race,
      trainingProposal,
    ] = await Promise.all([
      this.repository.findProfile(userId),
      this.prisma.athleteProfile.findUnique({ where: { userId } }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true, locale: true, profileVersion: true },
      }),
      this.prisma.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: true },
      }),
      this.repository.findActivePlan(userId),
      this.prisma.workout.findMany({
        where: {
          planVersion: { activeForPlan: { userId, status: "ACTIVE" } },
          scheduledDate: {
            gte: dateToDb(input.startDate),
            lte: dateToDb(input.endDate),
          },
        },
        orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
      }),
      input.raceId
        ? this.prisma.trainingRace.findFirst({
            where: { id: input.raceId, userId },
          })
        : Promise.resolve(null),
      input.trainingProposalId
        ? this.prisma.changeProposal.findFirst({
            where: { id: input.trainingProposalId, userId },
            include: { baseVersion: true },
          })
        : Promise.resolve(null),
    ]);
    if (!nutritionProfile)
      throw new BadRequestException({
        code: "NUTRITION_PROFILE_REQUIRED",
        message: "请先建立饮食档案",
      });
    const nutritionVersion = nutritionPlan?.activeVersion?.versionNo ?? 0;
    if (nutritionVersion !== input.expectedNutritionVersion)
      throw new ConflictException({
        code: "NUTRITION_VERSION_CONFLICT",
        message: "正式营养计划已更新，请重新生成",
      });
    if (input.mode === "INITIAL" && nutritionVersion !== 0)
      throw new ConflictException({
        code: "NUTRITION_PLAN_EXISTS",
        message: "已有正式营养计划，请使用重新生成场景",
      });
    if (input.mode === "REGENERATE" && nutritionVersion === 0)
      throw new ConflictException({
        code: "NUTRITION_PLAN_NOT_FOUND",
        message: "尚无正式营养计划，请使用首次生成场景",
      });
    const trainingVersion = plan?.activeVersion?.versionNo ?? 0;
    if (
      input.expectedTrainingPlanVersion !== undefined &&
      trainingVersion !== input.expectedTrainingPlanVersion
    )
      throw new ConflictException({
        code: "PLAN_VERSION_CONFLICT",
        message: "正式训练计划已更新，请重新生成",
      });
    if (
      input.mode === "TRAINING_LINKED" &&
      !input.workoutId &&
      !input.trainingProposalId
    )
      throw new BadRequestException({
        code: "TRAINING_CONTEXT_REQUIRED",
        message: "训练联动场景需要 workoutId 或 trainingProposalId",
      });
    if (input.trainingProposalId && input.mode !== "TRAINING_LINKED")
      throw new BadRequestException({
        code: "INVALID_TRAINING_LINK_MODE",
        message: "trainingProposalId 只能用于训练联动场景",
      });
    if (input.trainingProposalId && input.workoutId)
      throw new BadRequestException({
        code: "DUPLICATE_TRAINING_CONTEXT",
        message: "trainingProposalId 不能与 workoutId 同时使用",
      });
    if (
      input.mode === "TRAINING_LINKED" &&
      input.expectedTrainingPlanVersion === undefined
    )
      throw new BadRequestException({
        code: "PLAN_VERSION_REQUIRED",
        message: "训练联动场景需要 expectedTrainingPlanVersion",
      });
    if (input.trainingProposalId) {
      if (!trainingProposal)
        throw new NotFoundException({
          code: "TRAINING_PROPOSAL_NOT_FOUND",
          message: "训练提案不存在",
        });
      if (!trainingProposal.proposalType.startsWith("AI_"))
        throw new ConflictException({
          code: "TRAINING_PROPOSAL_NOT_SUPPORTED",
          message: "当前只支持从 AI 训练提案生成营养联动草稿",
        });
      if (!["READY", "APPLIED"].includes(trainingProposal.status))
        throw new ConflictException({
          code: "TRAINING_PROPOSAL_NOT_READY",
          message: "训练提案尚未通过校验",
        });
      if (
        (trainingProposal.baseVersionId ?? null) !==
        (plan?.activeVersionId ?? null)
      )
        throw new ConflictException({
          code: "PLAN_VERSION_CONFLICT",
          message: "训练提案基于旧版本，请重新生成",
        });
    }
    if (input.mode === "RACE_LINKED" && (!input.raceId || !race))
      throw new NotFoundException({
        code: "RACE_NOT_FOUND",
        message: "赛事不存在",
      });
    const selectedWorkout = input.workoutId
      ? workouts.find((workout) => workout.id === input.workoutId)
      : null;
    if (input.workoutId && !selectedWorkout)
      throw new NotFoundException({
        code: "WORKOUT_NOT_FOUND",
        message: "训练课程不存在",
      });
    return {
      timezone: user.timezone,
      locale: user.locale,
      profileVersion: user.profileVersion,
      nutritionProfile,
      athleteProfile: athleteProfile
        ? {
            heightCm: athleteProfile.heightCm
              ? Number(athleteProfile.heightCm)
              : null,
            weightKg: athleteProfile.weightKg
              ? Number(athleteProfile.weightKg)
              : null,
            ageBand: athleteProfile.ageBand,
            experienceLevel: athleteProfile.experienceLevel,
          }
        : null,
      trainingPlanVersion: trainingVersion,
      workouts: workouts.map((workout) => ({
        id: workout.id,
        scheduledDate: dbToDate(workout.scheduledDate),
        title: workout.title,
        purpose: workout.purpose,
        timeTargetMin: workout.timeTargetMin
          ? Number(workout.timeTargetMin)
          : null,
        distanceTargetKm: workout.distanceTargetKm
          ? Number(workout.distanceTargetKm)
          : null,
        structure: workout.structure,
      })),
      selectedWorkout: selectedWorkout
        ? {
            id: selectedWorkout.id,
            scheduledDate: dbToDate(selectedWorkout.scheduledDate),
            title: selectedWorkout.title,
            purpose: selectedWorkout.purpose,
            structure: selectedWorkout.structure,
          }
        : null,
      trainingChange: trainingProposal
        ? {
            proposalId: trainingProposal.id,
            proposalType: trainingProposal.proposalType,
            status: trainingProposal.status,
            basePlanVersion: trainingProposal.baseVersion?.versionNo ?? 0,
            original: trainingProposal.original,
            draft: trainingProposal.draft,
          }
        : null,
      race: race
        ? {
            id: race.id,
            name: race.name,
            localDate: dbToDate(race.localDate),
            distanceKm: Number(race.distanceKm),
            priority: race.priority,
          }
        : null,
      existingNutritionPlan: nutritionPlan
        ? {
            version: nutritionVersion,
            items:
              nutritionPlan.activeVersion?.items.map((item) => ({
                id: item.id,
                localDate: dbToDate(item.localDate),
                mealType: item.mealType,
                title: item.title,
                foods: item.foods,
                nutrients: item.nutrients,
              })) ?? [],
          }
        : null,
    };
  }

  private errorCode(error: unknown) {
    if (error instanceof AiException) return error.code;
    if (error instanceof z.ZodError) return "AI_OUTPUT_INVALID";
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      return `DB_${error.code}`;
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException
    ) {
      const response = error.getResponse();
      if (
        response &&
        typeof response === "object" &&
        "code" in response &&
        typeof response.code === "string"
      )
        return response.code;
    }
    return error instanceof SyntaxError
      ? "AI_OUTPUT_INVALID"
      : "AI_GENERATION_FAILED";
  }

  private toResponse(job: {
    id: string;
    status: string;
    proposalId: string | null;
    errorCode: string | null;
    requestId: string | null;
  }) {
    return {
      generationId: job.id,
      status: job.status,
      proposalId: job.proposalId,
      errorCode: job.errorCode,
      requestId: job.requestId,
    };
  }
}
