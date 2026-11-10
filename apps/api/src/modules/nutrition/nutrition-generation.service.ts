import { watchGeneration } from "../../infra/prisma/watch-generation";
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
  generationResponseSchema,
  nutritionAiOutputSchema,
  nutritionGenerationInputSchema,
  NutritionGenerationInput,
} from "@ridepilot/contracts";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AiException } from "../../ai/exceptions/ai.exception";
import { AiService } from "../../ai/ai.service";
import { Prisma } from "../../generated/prisma/client";
import {
  generationFingerprint,
  reusableGeneration,
  supersedeGenerationCandidates,
} from "../../infra/prisma/generation-candidates";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dbToDate, dateToDb } from "../training/training.validation";
import { toPlanDraft, toProfileResponse } from "./nutrition.mapper";
import { NutritionGenerationContextService } from "./nutrition-generation-context.service";
import { NutritionSkillLoaderService } from "./nutrition-skill-loader.service";
import { validateNutritionDraft } from "./nutrition.validation";
import { RaceNutritionService } from "./race-nutrition.service";

import { TrainingNutritionService } from "./training-nutrition.service";

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
    private readonly context: NutritionGenerationContextService,
    private readonly races: RaceNutritionService,
    private readonly training: TrainingNutritionService,
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
    const create = async (tx: Prisma.TransactionClient) => {
      const previous = await tx.aiGeneration.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (previous) {
        if (
          previous.scene !== "NUTRITION_PLAN" ||
          JSON.stringify(
            nutritionGenerationInputSchema.parse(previous.input),
          ) !== JSON.stringify(parsed)
        )
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "幂等键已用于不同请求",
          });
        return generationResponseSchema.parse(this.toResponse(previous));
      }
      const context = await this.context.read(userId, parsed, tx);
      const reusable = await reusableGeneration(
        tx,
        userId,
        "NUTRITION_PLAN",
        parsed,
        async (id) => {
          const p = await tx.nutritionProposal.findFirst({
            where: { id, userId },
          });
          if (
            !p ||
            !["DRAFT", "READY", "BLOCKED"].includes(p.status) ||
            (p.expiresAt && p.expiresAt <= new Date())
          )
            return false;
          const metadata = p.metadata as {
            generationContext?: { fingerprint: string };
          } | null;
          return (
            metadata?.generationContext?.fingerprint ===
            generationFingerprint(context)
          );
        },
      );
      if (reusable)
        return generationResponseSchema.parse(this.toResponse(reusable));
      return generationResponseSchema.parse(
        this.toResponse(
          await tx.aiGeneration.create({
            data: {
              userId,
              scene: "NUTRITION_PLAN",
              input: parsed,
              idempotencyKey: key,
              requestId: randomUUID(),
            },
          }),
        ),
      );
    };
    if (parsed.mode === "RACE_LINKED")
      return this.races.reuseOrCreate(userId, parsed, key, create);
    if (parsed.mode === "TRAINING_LINKED")
      return this.training.reuseOrCreate(userId, parsed, key, create);
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
        return create(tx);
      },
      { timeout: 15_000 },
    );
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
    const execution = watchGeneration(this.prisma, job);
    try {
      const input = nutritionGenerationInputSchema.parse(job.input);
      const context = await this.context.read(job.userId, input);
      const skill = await this.skill.load(input.mode);
      const requestedDays =
        (dateToDb(input.endDate).getTime() -
          dateToDb(input.startDate).getTime()) /
          86_400_000 +
        1;
      const response = await this.ai.generate({
        signal: execution.signal,
        requestId: job.requestId ?? job.id,
        temperature: 0.2,
        // A multi-day race draft includes meals plus the model's reasoning.
        // The fixed 7k budget could be consumed before any JSON was returned.
        maxTokens: ["RACE_LINKED", "TRAINING_LINKED"].includes(input.mode)
          ? Math.min(32000, Math.max(7000, 5000 + requestedDays * 3000))
          : 7000,
        responseFormat: { type: "json_object" },
        metadata: {
          feature: "nutrition-plan",
          generationId: job.id,
          skillHash: skill.hash,
        },
        messages: [
          {
            role: "system",
            content:
              "You are the RidePilot sports nutrition draft generator. Return only complete JSON matching the supplied schema. Every object uses a strict schema: never add properties absent from outputSchema. draft must contain ONLY startDate, endDate, dailyTarget, items. Do not add race, raceId, timezone, strategy, hydration, fueling, or other extra fields to draft. Express race-day fueling and hydration guidance using the allowed meal items, their notes, summary and assumptions. Keep each meal concise with at most 3 foods, and do not repeat long explanations across dates. Write all human-facing text in Simplified Chinese. Never invent missing measurements, never diagnose or prescribe clinical treatment, and never apply a plan.",
          },
          { role: "system", content: skill.content },
          {
            role: "user",
            content: JSON.stringify({
              task: "Generate a conservative cycling nutrition draft for the requested date range. In TRAINING_LINKED mode use the latest official context.workouts, including days with no workouts; remove obsolete workout fueling when a long ride becomes rest, while keeping regular meals. Adjust pre/during/post workout fueling when duration or intensity changes. Respect the dietary profile. If workout start time is unknown, explain meal-time assumptions and use notes for relative fueling timing; never invent an exact workout start time.",
              outputContract:
                "Return one top-level JSON object with exactly these keys: summary, assumptions, draft, warnings, blockers, sourceRefs, confidence. Put all dates and meals inside draft; never put startDate, endDate, dailyTarget, or items at the top level. draft must contain startDate, endDate, dailyTarget (null or {energyKcal, carbohydrateG, proteinG, fatG, basis: ESTIMATE|USER_ENTERED|LABEL, confidence: HIGH|MEDIUM|LOW}), and items. Every item must contain localDate, mealType (BREAKFAST|LUNCH|DINNER|SNACK|PRE_WORKOUT|DURING_WORKOUT|POST_WORKOUT), scheduledLocalTime in HH:mm, title, foods, nutrients, nutritionSource (CURATED|LABEL|USER_ENTERED|AI_ESTIMATE), confidence (HIGH|MEDIUM|LOW), linkedWorkoutId (UUID or null), and notes (string or null). Every food must contain name, amount (positive number), unit (g|ml|piece|serving), allergenTags as an array containing only the exact enum values MILK|EGG|PEANUT|TREE_NUT|WHEAT|SOY|FISH|SHELLFISH|SESAME (use [] when no exact enum applies; never use words such as milk, egg, gluten, or 麸质), and ingredientStatus (KNOWN|PARTIAL|UNKNOWN). nutrients must contain energyKcal, carbohydrateG, proteinG, fatG, fluidMl, sodiumMg; use null when data is missing. Never return HYDRATION as a meal type and never return null scheduledLocalTime; use only times present in mealSchedule. If the profile only has one meal time, return at least that meal.",
              input,
              context,
              outputSchema: z.toJSONSchema(nutritionAiOutputSchema),
            }),
          },
        ],
      });
      const raw = JSON.parse(response.text) as unknown;
      const output = nutritionAiOutputSchema.parse(raw);
      if (
        output.draft.startDate !== input.startDate ||
        output.draft.endDate !== input.endDate ||
        output.draft.items.some(
          (item) =>
            item.localDate < input.startDate || item.localDate > input.endDate,
        )
      ) {
        throw new BadRequestException({
          code: "AI_OUTPUT_INVALID",
          message: "营养草稿超出请求日期范围",
        });
      }
      if (
        output.draft.items.some(
          (item) =>
            item.linkedWorkoutId &&
            !context.workouts.some(
              (workout) => workout.id === item.linkedWorkoutId,
            ),
        )
      )
        throw new BadRequestException({
          code: "AI_OUTPUT_INVALID",
          message: "补给关联了不属于当前训练范围的课程",
        });
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
        generationContext: {
          fingerprint: generationFingerprint(context),
          profileVersion: context.profileVersion,
          nutritionProfileVersion: context.nutritionProfile.version,
          trainingPlanVersionId: context.trainingContext.planVersionId,
          ...(context.race
            ? { raceId: context.race.id, raceVersion: context.race.version }
            : {}),
        },
        ...(input.mode === "TRAINING_LINKED"
          ? { trainingContext: context.trainingContext }
          : {}),
      };
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${job.userId}::uuid FOR UPDATE`;
        // Recheck both official versions after the potentially long model call.
        if (
          generationFingerprint(
            await this.context.read(job.userId, input, tx),
          ) !== generationFingerprint(context)
        )
          throw new ConflictException({
            code: "GENERATION_CONTEXT_CHANGED",
            message: "生成期间训练或饮食资料已变化，请重新生成",
          });
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
          include: { activeVersion: { include: { items: true } } },
        });
        const previousItems =
          plan?.activeVersion?.items.filter(
            (item) =>
              dbToDate(item.localDate) >= input.startDate &&
              dbToDate(item.localDate) <= input.endDate,
          ) ?? [];
        const proposal = await tx.nutritionProposal.create({
          data: {
            userId: job.userId,
            planId: plan?.id,
            baseVersionId: plan?.activeVersionId,
            proposalType: "AI_PLAN",
            status: blockers.length ? "BLOCKED" : "READY",
            draft: output.draft,
            original: previousItems.length
              ? (toPlanDraft(
                  previousItems,
                  input.startDate,
                  input.endDate,
                  (
                    plan?.activeVersion?.snapshot as {
                      dailyTarget?: unknown;
                    } | null
                  )?.dailyTarget ?? null,
                ) as Prisma.InputJsonValue)
              : undefined,
            metadata,
            validationPassed: blockers.length === 0,
            validationWarnings: warnings,
            validationBlockers: blockers,
          },
        });
        if (!blockers.length)
          await supersedeGenerationCandidates(
            tx,
            job,
            proposal.id,
            "NUTRITION",
            async (id) => {
              const p = await tx.nutritionProposal.findFirst({
                where: { id, userId: job.userId },
              });
              const snapshot = (
                p?.metadata as {
                  generationContext?: { fingerprint: string };
                } | null
              )?.generationContext;
              return (
                !!snapshot &&
                snapshot.fingerprint === generationFingerprint(context) &&
                (!p?.expiresAt || p.expiresAt > new Date())
              );
            },
          );
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
        ((error instanceof AiException && error.retryable) ||
          code === "AI_OUTPUT_INVALID");
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
    } finally {
      execution.stop();
    }
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
