import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  generationResponseSchema,
  weekGenerationInputSchema,
  type RacePlanningPhase,
  type RaceTrainingState,
  type WeekGenerationInput,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AiGenerationService } from "./ai-generation.service";
import { CoachProposalService } from "./coach-proposal.service";
import { addRaceDays, racePlanningWindow } from "./race-planning.validation";
import { assertDateRange } from "./stage-plan.validation";

@Injectable()
export class RaceTrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generations: AiGenerationService,
    private readonly proposals: CoachProposalService,
  ) {}

  async get(
    userId: string,
    raceId: string,
    requested?: RacePlanningPhase,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<RaceTrainingState> {
    const race = await db.trainingRace.findFirst({
      where: { id: raceId, userId },
    });
    if (!race)
      throw new NotFoundException({
        code: "RACE_NOT_FOUND",
        message: "赛事不存在",
      });
    const [user, plan, jobs] = await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true },
      }),
      db.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: true },
      }),
      db.aiGeneration.findMany({
        where: {
          userId,
          scene: "RACE_REPLAN",
          input: { path: ["relatedId"], equals: raceId },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const window = racePlanningWindow(race, today, requested);
    const relevant = jobs.filter((job) => {
      const input = weekGenerationInputSchema.safeParse(job.input);
      if (!input.success || input.data.relatedId !== raceId) return false;
      const phase =
        input.data.racePhase ??
        (input.data.notes?.includes("比赛已结束") ? "RECOVERY" : "PREPARATION");
      return phase === window.phase;
    });
    const rows = await db.changeProposal.findMany({
      where: {
        userId,
        proposalType: "AI_RACE_REPLAN",
        id: {
          in: relevant.flatMap((job) =>
            job.proposalId ? [job.proposalId] : [],
          ),
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const current = rows.filter((row) => {
      const draft = row.draft as Record<string, unknown>;
      const lastDate =
        typeof draft.endDate === "string"
          ? draft.endDate
          : typeof draft.weekStartDate === "string"
            ? addRaceDays(draft.weekStartDate, 6)
            : today;
      const hasPastCourses =
        Array.isArray(draft.workouts) &&
        draft.workouts.some(
          (item: { scheduledDate?: string }) =>
            item.scheduledDate && item.scheduledDate < today,
        );
      return (
        draft.relatedVersion === race.version &&
        (!row.expiresAt || row.expiresAt > new Date()) &&
        ((row.status === "APPLIED" &&
          row.appliedVersionId === plan?.activeVersionId) ||
          (["DRAFT", "READY", "BLOCKED"].includes(row.status) &&
            (row.baseVersionId ?? null) === (plan?.activeVersionId ?? null) &&
            lastDate >= today &&
            !hasPastCourses))
      );
    });
    const pending = relevant.filter((job) => {
      const input = weekGenerationInputSchema.parse(job.input);
      return (
        ["QUEUED", "RUNNING"].includes(job.status) &&
        job.createdAt >= race.updatedAt &&
        input.expectedBaseVersion === (plan?.activeVersion?.versionNo ?? 0) &&
        (input.relatedVersion === undefined ||
          input.relatedVersion === race.version)
      );
    });
    const explicit = relevant.find(
      (job) =>
        weekGenerationInputSchema.parse(job.input).forceRegenerate &&
        (current.some(
          (row) => row.id === job.proposalId && row.status !== "APPLIED",
        ) ||
          pending.some((row) => row.id === job.id)),
    );
    const available = explicit
      ? current.find((row) => row.id === explicit.proposalId)
      : (current.find((row) => row.status === "APPLIED") ?? current[0]);
    const job =
      explicit ??
      (available
        ? relevant.find((job) => job.proposalId === available.id)
        : pending[0]);
    const recoveredInput = job
      ? weekGenerationInputSchema.parse(job.input)
      : null;
    return {
      ...window,
      ...(recoveredInput?.endDate && recoveredInput.weekStartDate >= today
        ? {
            startDate: recoveredInput.weekStartDate,
            endDate: recoveredInput.endDate,
          }
        : {}),
      generation: job
        ? generationResponseSchema.parse({
            generationId: job.id,
            status: job.status,
            proposalId: job.proposalId,
            errorCode: job.errorCode,
            requestId: job.requestId,
          })
        : null,
      proposal: available
        ? await this.proposals.get(userId, available.id)
        : null,
      message:
        !job && relevant.length
          ? "之前的计划已因赛事、训练版本或日期变化失效，请选择当前日期范围后重新生成。"
          : null,
    };
  }

  async submit(
    userId: string,
    raceId: string,
    input: WeekGenerationInput,
    key: string,
  ) {
    if (!key || key.length > 255)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少有效幂等键",
      });
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
        const normalized = {
          ...input,
          relatedId: raceId,
          reason: "RACE" as const,
        };
        const existing = await tx.aiGeneration.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
        });
        if (existing) {
          if (
            existing.scene !== "RACE_REPLAN" ||
            JSON.stringify(weekGenerationInputSchema.parse(existing.input)) !==
              JSON.stringify(weekGenerationInputSchema.parse(normalized))
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
        const state = await this.get(userId, raceId, input.racePhase, tx);
        if (input.endDate) {
          assertDateRange(input.weekStartDate, input.endDate, 84);
          if (input.weekStartDate < state.today)
            throw new BadRequestException({
              code: "INVALID_DATE_RANGE",
              message: "请选择今天或未来的开始日期",
            });
        }
        if (
          state.generation &&
          (!input.forceRegenerate ||
            ["QUEUED", "RUNNING"].includes(state.generation.status))
        )
          return state.generation;
        // Use the same transaction and user lock for context checks and task creation.
        return this.generations.submit(
          userId,
          normalized,
          key,
          "RACE_REPLAN",
          tx,
        );
      },
      { timeout: 15_000 },
    );
  }
}
