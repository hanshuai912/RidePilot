import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  stageReviewFollowupSchema,
  type StageReviewInput,
} from "@ridepilot/contracts";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { generationFingerprint } from "../../../infra/prisma/generation-candidates";
import {
  readStageSnapshot,
  stageReviewResponse,
} from "./stage-review.repository";
import { validateStageDecision } from "./stage-review.policy";

@Injectable()
export class StageReviewService {
  constructor(private readonly prisma: PrismaService) {}
  state(userId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const snapshot = await readStageSnapshot(tx, userId, id);
        const history = await tx.trainingStageReview.findMany({
          where: { userId, stageId: id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
        });
        const jobs = history.length
          ? await tx.aiGeneration.findMany({
              where: {
                userId,
                scene: { in: ["STAGE_PLAN", "RANGE_PLAN"] },
                OR: history.map((r) => ({
                  input: { path: ["stageReviewId"], equals: r.id },
                })),
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 30,
            })
          : [];
        const followups = jobs.map((job) =>
          stageReviewFollowupSchema.parse({
            generationId: job.id,
            reviewId: (job.input as Record<string, unknown>).stageReviewId,
            kind: job.scene === "STAGE_PLAN" ? "STAGES" : "COURSES",
            status: job.status,
            proposalId: job.proposalId,
            errorCode: job.errorCode,
          }),
        );
        return {
          snapshot,
          history: history.map(stageReviewResponse),
          followups,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async criteria(
    userId: string,
    id: string,
    input: { criteria: string; expectedVersion: number },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const stage = await tx.trainingStage.findFirst({
        where: { id, stagePlan: { userId } },
      });
      if (!stage)
        throw new NotFoundException({
          code: "STAGE_NOT_FOUND",
          message: "阶段不存在",
        });
      if (
        stage.criteriaVersion === input.expectedVersion &&
        stage.criteria === input.criteria
      )
        return;
      if (
        stage.criteriaVersion === input.expectedVersion + 1 &&
        stage.criteria === input.criteria
      )
        return;
      if (stage.criteriaVersion !== input.expectedVersion)
        throw new ConflictException({
          code: "STAGE_CRITERIA_CONFLICT",
          message: "达成条件已变化，请刷新",
        });
      await tx.trainingStage.update({
        where: { id },
        data: { criteria: input.criteria, criteriaVersion: { increment: 1 } },
      });
    });
    return this.state(userId, id);
  }
  save(userId: string, id: string, input: StageReviewInput, key: string) {
    if (!key || key.length > 255)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少有效幂等键",
      });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const hash = generationFingerprint({ id, input });
      const existing = await tx.trainingStageReview.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (existing) {
        if (existing.requestHash !== hash)
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "幂等键已用于不同复评",
          });
        return stageReviewResponse(existing);
      }
      const snapshot = await readStageSnapshot(tx, userId, id);
      const latest = await tx.trainingStageReview.findFirst({
        where: { userId, stageId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if ((latest?.id ?? null) !== input.expectedReviewId)
        throw new ConflictException({
          code: "STAGE_REVIEW_VERSION_CONFLICT",
          message: "已有新的阶段决定，请刷新后重新预览",
        });
      validateStageDecision(snapshot, input);
      return stageReviewResponse(
        await tx.trainingStageReview.create({
          data: {
            createdAt: new Date(
              Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1),
            ),
            userId,
            stageId: id,
            outcome: input.outcome,
            decision: input.decision,
            rationale: input.rationale,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            idempotencyKey: key,
            requestHash: hash,
          },
        }),
      );
    });
  }
}
