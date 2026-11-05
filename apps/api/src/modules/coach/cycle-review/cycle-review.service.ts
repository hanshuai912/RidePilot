import { Prisma } from "../../../generated/prisma/client";
import { Injectable } from "@nestjs/common";
import {
  cycleReviewEvidenceSchema,
  cycleReviewHistorySchema,
  weekGenerationInputSchema,
  type CycleReviewGeneration,
} from "@ridepilot/contracts";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { AiGenerationService } from "../ai-generation.service";
import { buildCycleReview } from "./cycle-review.policy";
import { readCycleReviewData } from "./cycle-review.repository";

@Injectable()
export class CycleReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generations: AiGenerationService,
  ) {}

  get(userId: string, range?: { startDate: string; endDate: string }) {
    return this.prisma.$transaction(
      async (tx) =>
        buildCycleReview(await readCycleReviewData(tx, userId, range)),
      { isolationLevel: "RepeatableRead" },
    );
  }

  generate(userId: string, input: CycleReviewGeneration, key: string) {
    return this.generations.submit(
      userId,
      weekGenerationInputSchema.parse({
        mode: "range",
        goalId: input.goalId,
        weekStartDate: input.startDate,
        endDate: input.endDate,
        expectedBaseVersion: input.expectedBaseVersion,
        cycleReview: input.review,
        notes: input.notes,
        forceRegenerate: input.forceRegenerate,
      }),
      key,
      "RANGE_PLAN",
    );
  }

  history(userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const jobs = await tx.aiGeneration.findMany({
          where: {
            userId,
            scene: "RANGE_PLAN",
            input: { path: ["cycleReview"], not: Prisma.AnyNull },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
        });
        const proposals = await tx.changeProposal.findMany({
          where: {
            userId,
            id: {
              in: jobs.flatMap((j) => (j.proposalId ? [j.proposalId] : [])),
            },
          },
        });
        const versions = await tx.planVersion.findMany({
          where: {
            id: {
              in: proposals.flatMap((p) =>
                p.appliedVersionId ? [p.appliedVersionId] : [],
              ),
            },
            plan: { userId },
          },
          select: { id: true, versionNo: true },
        });
        return cycleReviewHistorySchema.parse({
          items: jobs.flatMap((job) => {
            const parsed = weekGenerationInputSchema.safeParse(job.input);
            if (
              !parsed.success ||
              !parsed.data.cycleReview ||
              !parsed.data.endDate
            )
              return [];
            const proposal = proposals.find((p) => p.id === job.proposalId);
            const draft = proposal?.draft as
              Record<string, unknown> | undefined;
            const evidence = cycleReviewEvidenceSchema.safeParse(
              draft?.cycleReview,
            );
            return [
              {
                generationId: job.id,
                proposalId: job.proposalId,
                createdAt: job.createdAt.toISOString(),
                status: proposal?.status ?? job.status,
                errorCode: job.errorCode,
                review: parsed.data.cycleReview,
                startDate: parsed.data.weekStartDate,
                endDate: parsed.data.endDate,
                appliedPlanVersion:
                  versions.find((v) => v.id === proposal?.appliedVersionId)
                    ?.versionNo ?? null,
                evidence: evidence.success ? evidence.data : null,
              },
            ];
          }),
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
