import { nutritionGenerationStaleReason } from "./nutrition-generation-validity";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  generationResponseSchema,
  nutritionGenerationInputSchema,
  type NutritionGenerationInput,
  type RaceNutritionState,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { toProposalResponse } from "./nutrition.mapper";

@Injectable()
export class RaceNutritionService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    userId: string,
    raceId: string,
    db: Prisma.TransactionClient = this.prisma,
    range?: Pick<NutritionGenerationInput, "startDate" | "endDate">,
  ): Promise<RaceNutritionState> {
    const race = await db.trainingRace.findFirst({
      where: { id: raceId, userId },
    });
    if (!race)
      throw new NotFoundException({
        code: "RACE_NOT_FOUND",
        message: "赛事不存在",
      });
    const [jobs, plan] = await Promise.all([
      db.aiGeneration.findMany({
        where: {
          userId,
          scene: "NUTRITION_PLAN",
          status: { in: ["READY", "QUEUED", "RUNNING"] },
          input: { path: ["raceId"], equals: raceId },
          createdAt: { gte: race.updatedAt },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.nutritionPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: true },
      }),
    ]);
    const eligible = jobs.filter((job) => {
      const parsed = nutritionGenerationInputSchema.safeParse(job.input);
      if (
        !parsed.success ||
        parsed.data.mode !== "RACE_LINKED" ||
        parsed.data.raceId !== raceId
      )
        return false;
      return (
        !range ||
        (parsed.data.startDate === range.startDate &&
          parsed.data.endDate === range.endDate)
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
      orderBy: { createdAt: "desc" },
    });
    const staleIds = new Set(
      (
        await Promise.all(
          proposals.map(async (p) =>
            p.status !== "APPLIED" &&
            (await nutritionGenerationStaleReason(db, userId, p.metadata))
              ? p.id
              : null,
          ),
        )
      ).filter((id): id is string => !!id),
    );
    // An accidental newer draft must not hide the plan the user already applied.
    const applied = proposals.find(
      (item) =>
        item.status === "APPLIED" &&
        item.appliedVersionId != null &&
        item.appliedVersionId === plan?.activeVersionId,
    );
    const validDrafts = proposals.filter(
      (item) =>
        !staleIds.has(item.id) &&
        ["DRAFT", "READY", "BLOCKED"].includes(item.status) &&
        (item.baseVersionId ?? null) === (plan?.activeVersionId ?? null) &&
        (!item.expiresAt || item.expiresAt.getTime() > Date.now()),
    );
    const pending = (item: (typeof eligible)[number]) =>
      ["QUEUED", "RUNNING"].includes(item.status) &&
      nutritionGenerationInputSchema.parse(item.input)
        .expectedNutritionVersion === (plan?.activeVersion?.versionNo ?? 0);
    // An explicit regeneration is a candidate the user asked to review, while
    // the applied version remains official until they confirm the replacement.
    const requested = eligible.find(
      (item) =>
        nutritionGenerationInputSchema.parse(item.input).forceRegenerate ===
          true &&
        (validDrafts.some((draft) => draft.id === item.proposalId) ||
          pending(item)),
    );
    const available = requested
      ? validDrafts.find((item) => item.id === requested.proposalId)
      : (applied ?? validDrafts[0]);
    const job =
      requested ??
      (available
        ? eligible.find((item) => item.proposalId === available.id)
        : eligible.find(pending));
    if (!job) return { generation: null, proposal: null };
    return {
      generation: generationResponseSchema.parse({
        generationId: job.id,
        status: job.status,
        proposalId: job.proposalId,
        errorCode: job.errorCode,
        requestId: job.requestId,
      }),
      proposal: available ? toProposalResponse(available) : null,
    };
  }

  async reuseOrCreate(
    userId: string,
    input: NutritionGenerationInput,
    key: string,
    create: (
      tx: Prisma.TransactionClient,
    ) => Promise<NonNullable<RaceNutritionState["generation"]>>,
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
        if (!input.raceId)
          throw new NotFoundException({
            code: "RACE_NOT_FOUND",
            message: "赛事不存在",
          });
        const current = await this.get(userId, input.raceId, tx, input);
        if (
          current.generation &&
          (!input.forceRegenerate ||
            ["QUEUED", "RUNNING"].includes(current.generation.status))
        )
          return current.generation;
        return create(tx);
      },
      { timeout: 15_000 },
    );
  }
}
