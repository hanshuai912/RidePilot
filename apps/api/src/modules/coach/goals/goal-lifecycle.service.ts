import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  goalChangeResultSchema,
  type GoalChange,
  type GoalInput,
  type GoalPatch,
} from "@ridepilot/contracts";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { generationFingerprint } from "../../../infra/prisma/generation-candidates";
import {
  buildGoalPreview,
  evaluateGoal,
  validateGoalInput,
} from "./goal-lifecycle.policy";
import { goalResponse, readGoalContext } from "./goal-lifecycle.repository";

@Injectable()
export class GoalLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  evaluate(userId: string, input: GoalInput) {
    return this.prisma.$transaction(
      async (tx) => {
        const [user, ftp, profile, availability, activeGoals] =
          await Promise.all([
            tx.user.findUniqueOrThrow({ where: { id: userId } }),
            tx.abilityMeasurement.findFirst({
              where: { userId, metricType: "FTP", unit: "W" },
              orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
            }),
            tx.athleteProfile.findUnique({ where: { userId } }),
            tx.trainingAvailability.findUnique({ where: { userId } }),
            tx.trainingGoal.findMany({
              where: { userId, status: "ACTIVE" },
              select: { priority: true },
            }),
          ]);
        const localDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: user.timezone,
        }).format(new Date());
        validateGoalInput(input);
        this.checkFirstGoalPriority(input, activeGoals.length);
        return {
          evaluation: evaluateGoal(
            { ftp, profile, availability, localDate },
            input,
          ),
          warnings: [
            "保存目标后，阶段与课程需主动生成并确认。",
            ...(activeGoals.some((goal) => goal.priority === "PRIMARY")
              ? [
                  "新目标作为次目标添加，现有主目标保留。需要切换时，请在添加后编辑新目标并选择设为主目标。",
                ]
              : []),
          ],
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async overview(userId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const context = await readGoalContext(tx, userId, id);
        const history = await tx.goalMutation.findMany({
          where: { userId, goalId: id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
        });
        return {
          goal: goalResponse(context.goal),
          evaluation: evaluateGoal(context, goalResponse(context.goal)),
          history: history.map((h) => ({
            id: h.id,
            action: h.action,
            reason: h.reason,
            createdAt: h.createdAt.toISOString(),
          })),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  preview(userId: string, id: string, change: GoalChange) {
    return this.prisma.$transaction(
      async (tx) =>
        buildGoalPreview(await readGoalContext(tx, userId, id), change),
      { isolationLevel: "RepeatableRead" },
    );
  }
  async apply(
    userId: string,
    id: string,
    change: GoalChange,
    fingerprint: string | undefined,
    key: string,
  ) {
    this.checkKey(key);
    const hash = generationFingerprint({ id, change, fingerprint });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const existing = await tx.goalMutation.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (existing) {
        if (existing.requestHash !== hash)
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "幂等键已用于不同操作",
          });
        return goalChangeResultSchema.parse(existing.result);
      }
      const preview = buildGoalPreview(
        await readGoalContext(tx, userId, id),
        change,
      );
      if (fingerprint && fingerprint !== preview.fingerprint)
        throw new ConflictException({
          code: "GOAL_PREVIEW_STALE",
          message: "预览依据已变化，请刷新并重新预览",
        });
      for (const other of preview.affected.otherPrimaryGoals)
        await tx.trainingGoal.update({
          where: { id: other.id },
          data: { priority: "SECONDARY", version: { increment: 1 } },
        });
      const {
        id: _,
        version: __,
        closureReason,
        status,
        ...fields
      } = preview.after;
      const updated = await tx.trainingGoal.update({
        where: { id },
        data: {
          ...fields,
          closureReason,
          status,
          version: { increment: 1 },
        },
      });
      const next = preview.nextGoal
        ? await tx.trainingGoal.create({
            data: {
              ...preview.nextGoal,
              targetDate: null,
              userId,
            },
          })
        : null;
      const result = {
        mutationId: randomUUID(),
        goal: goalResponse(updated),
        nextGoal: next ? goalResponse(next) : null,
      };
      await tx.goalMutation.create({
        data: {
          id: result.mutationId,
          userId,
          goalId: id,
          idempotencyKey: key,
          requestHash: hash,
          action: change.action,
          reason: change.reason,
          result: { ...result, preview } as unknown as Prisma.InputJsonValue,
        },
      });
      return result;
    });
  }
  async create(userId: string, input: GoalInput, key: string = randomUUID()) {
    this.checkKey(key);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const hash = generationFingerprint({ create: input });
      const existing = await tx.goalMutation.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (existing) {
        if (existing.requestHash !== hash)
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "幂等键已用于其他目标",
          });
        return goalChangeResultSchema.parse(existing.result).goal;
      }
      const activeCount = await tx.trainingGoal.count({
        where: { userId, status: "ACTIVE" },
      });
      this.checkFirstGoalPriority(input, activeCount);
      validateGoalInput(input);
      const { targetDate: _legacyDate, ...conditions } = input;
      if (
        input.priority === "PRIMARY" &&
        (await tx.trainingGoal.count({
          where: { userId, status: "ACTIVE", priority: "PRIMARY" },
        }))
      )
        throw new ConflictException({
          code: "PRIMARY_GOAL_EXISTS",
          message: "已有活跃主目标，请将新目标设为次目标，再通过预览切换主目标",
        });
      const goal = await tx.trainingGoal.create({
        data: {
          ...conditions,
          userId,
          targetDate: null,
        },
      });
      const result = {
        mutationId: randomUUID(),
        goal: goalResponse(goal),
        nextGoal: null,
      };
      await tx.goalMutation.create({
        data: {
          id: result.mutationId,
          userId,
          goalId: goal.id,
          idempotencyKey: key,
          requestHash: hash,
          action: "CREATE",
          reason: "建立训练目标",
          result,
        },
      });
      return result.goal;
    });
  }
  async patch(userId: string, id: string, input: GoalPatch) {
    const { expectedVersion, status, ...changes } = input;
    const action =
      status === "PAUSED"
        ? "PAUSE"
        : status === "CLOSED"
          ? "CLOSE"
          : status === "ACTIVE"
            ? "RESUME"
            : "UPDATE";
    if (status && Object.keys(changes).length)
      throw new BadRequestException({
        code: "INVALID_GOAL_ACTION",
        message: "状态变更请使用目标变更预览，或单独提交状态",
      });
    return (
      await this.apply(
        userId,
        id,
        {
          action,
          expectedVersion,
          reason: "用户更新目标资料",
          ...(!status ? { changes } : {}),
        },
        undefined,
        randomUUID(),
      )
    ).goal;
  }
  private checkKey(key: string) {
    if (!key || key.length > 255)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少有效幂等键",
      });
  }
  private checkFirstGoalPriority(input: GoalInput, activeCount: number) {
    if (activeCount === 0 && input.priority !== "PRIMARY")
      throw new ConflictException({
        code: "PRIMARY_GOAL_REQUIRED",
        message: "当前没有进行中的目标，请刷新后将新目标作为主目标添加",
      });
  }
}
