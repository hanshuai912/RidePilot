import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  generationResponseSchema,
  nutritionGenerationInputSchema,
  type NutritionGenerationInput,
  type TrainingNutritionState,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dateToDb } from "../training/training.validation";
import { toProposalResponse } from "./nutrition.mapper";
import { trainingDateSignatures } from "./training-nutrition-context";

@Injectable()
export class TrainingNutritionService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    userId: string,
    from: string,
    to: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<TrainingNutritionState> {
    const days =
      (dateToDb(to).getTime() - dateToDb(from).getTime()) / 86400000 + 1;
    if (days < 1 || days > 31)
      throw new BadRequestException({
        code: "NUTRITION_DATE_INVALID",
        message: "请选择 1–31 天的补给调整范围",
      });
    const [training, nutrition, jobs, workouts] = await Promise.all([
      db.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: true },
      }),
      db.nutritionPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: true },
      }),
      db.aiGeneration.findMany({
        where: {
          userId,
          scene: "NUTRITION_PLAN",
          input: { path: ["mode"], equals: "TRAINING_LINKED" },
          status: { in: ["READY", "QUEUED", "RUNNING"] },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.workout.findMany({
        where: {
          planVersion: { activeForPlan: { userId, status: "ACTIVE" } },
          scheduledDate: { gte: dateToDb(from), lte: dateToDb(to) },
        },
        orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
      }),
    ]);
    const version = training?.activeVersion?.versionNo ?? 0;
    const nutritionVersion = nutrition?.activeVersion?.versionNo ?? 0;
    const signatures = trainingDateSignatures(from, to, workouts);
    const snapshot = nutrition?.activeVersion?.snapshot as {
      trainingDateSignatures?: Record<string, string>;
    } | null;
    const affectedDates = Object.keys(signatures).filter(
      (date) => snapshot?.trainingDateSignatures?.[date] !== signatures[date],
    );
    const eligible = jobs.filter((job) => {
      const parsed = nutritionGenerationInputSchema.safeParse(job.input);
      return (
        parsed.success &&
        parsed.data.startDate === from &&
        parsed.data.endDate === to &&
        parsed.data.expectedTrainingPlanVersion === version
      );
    });
    const proposals = await db.nutritionProposal.findMany({
      where: {
        userId,
        id: {
          in: eligible.flatMap((job) =>
            job.proposalId ? [job.proposalId] : [],
          ),
        },
      },
      include: { baseVersion: true },
    });
    const valid = proposals.filter(
      (item) =>
        (item.status === "APPLIED" &&
          item.appliedVersionId === nutrition?.activeVersionId) ||
        (["DRAFT", "READY", "BLOCKED"].includes(item.status) &&
          (item.baseVersionId ?? null) ===
            (nutrition?.activeVersionId ?? null) &&
          (!item.expiresAt || item.expiresAt > new Date())),
    );
    const job = eligible.find(
      (item) =>
        valid.some((proposal) => proposal.id === item.proposalId) ||
        (["QUEUED", "RUNNING"].includes(item.status) &&
          nutritionGenerationInputSchema.parse(item.input)
            .expectedNutritionVersion === nutritionVersion),
    );
    const proposal = valid.find((item) => item.id === job?.proposalId);
    return {
      from,
      to,
      trainingPlanVersion: version,
      nutritionVersion,
      affectedDates,
      generation: job
        ? generationResponseSchema.parse({
            generationId: job.id,
            status: job.status,
            proposalId: job.proposalId,
            errorCode: job.errorCode,
            requestId: job.requestId,
          })
        : null,
      proposal: proposal ? toProposalResponse(proposal) : null,
    };
  }

  async reuseOrCreate(
    userId: string,
    input: NutritionGenerationInput,
    key: string,
    create: (
      tx: Prisma.TransactionClient,
    ) => Promise<NonNullable<TrainingNutritionState["generation"]>>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
        const existing = await tx.aiGeneration.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
        });
        if (existing) {
          if (
            existing.scene !== "NUTRITION_PLAN" ||
            JSON.stringify(
              nutritionGenerationInputSchema.parse(existing.input),
            ) !== JSON.stringify(input)
          )
            throw new ConflictException({
              code: "IDEMPOTENCY_KEY_CONFLICT",
              message: "幂等键已用于不同请求",
            });
          return generationResponseSchema.parse({
            generationId: existing.id,
            status: existing.status,
            proposalId: existing.proposalId,
            errorCode: existing.errorCode,
            requestId: existing.requestId,
          });
        }
        const state = await this.get(
          userId,
          input.startDate,
          input.endDate,
          tx,
        );
        if (
          state.generation &&
          (!input.forceRegenerate ||
            ["QUEUED", "RUNNING"].includes(state.generation.status))
        )
          return state.generation;
        return create(tx);
      },
      { timeout: 15000 },
    );
  }
}
