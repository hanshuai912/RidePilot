import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  assessmentSchema,
  type Assessment,
  type AssessmentInput,
  type AssessmentPatch,
  type AssessmentFtpInput,
} from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dateToDb, dbToDate } from "../training/training.validation";
import { assessmentResponse } from "./assessment.mapper";
import {
  AssessmentScheduleService,
  assessmentHash,
  assessmentToday,
} from "./assessment-schedule.service";
import { validateAssessmentResult } from "./assessment-result.validation";

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedules: AssessmentScheduleService,
  ) {}

  async get(
    userId: string,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const item = await db.trainingAssessment.findFirst({
      where: { id, userId },
    });
    if (!item)
      throw new NotFoundException({
        code: "ASSESSMENT_NOT_FOUND",
        message: "测试不存在",
      });
    return item;
  }

  async list(
    userId: string,
    query: { goalId?: string; from?: string; to?: string },
  ) {
    return (
      await this.prisma.trainingAssessment.findMany({
        where: {
          userId,
          ...(query.goalId ? { goalId: query.goalId } : {}),
          ...(query.from || query.to
            ? {
                localDate: {
                  ...(query.from ? { gte: dateToDb(query.from) } : {}),
                  ...(query.to ? { lte: dateToDb(query.to) } : {}),
                },
              }
            : {}),
        },
        orderBy: [{ localDate: "desc" }, { id: "asc" }],
        // Bounded calendar requests include all events. Goal/history list is capped.
        ...(query.from && query.to ? {} : { take: 100 }),
      })
    ).map(assessmentResponse);
  }

  private async write(
    userId: string,
    key: string,
    payload: unknown,
    action: (tx: Prisma.TransactionClient) => Promise<Assessment>,
  ) {
    if (!key || !/^[\w-]{1,128}$/.test(key))
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "请提供有效的幂等键",
      });
    const signature = assessmentHash(payload);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const previous = await tx.assessmentMutation.findUnique({
        where: { userId_key: { userId, key } },
      });
      if (previous) {
        if (previous.signature !== signature)
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_REUSED",
            message: "本次提交内容已变化，请使用新的请求重试",
          });
        return assessmentSchema.parse(previous.response);
      }
      const result = await action(tx);
      await tx.assessmentMutation.create({
        data: { userId, key, signature, response: result },
      });
      return result;
    });
  }

  create(userId: string, input: AssessmentInput, key: string) {
    return this.write(userId, key, { action: "CREATE", input }, async (tx) => {
      await this.schedules.confirm(
        tx,
        userId,
        input,
        input.previewToken,
        input.acknowledgeConflicts,
      );
      const ftp = await this.latestFtp(tx, userId);
      return assessmentResponse(
        await tx.trainingAssessment.create({
          data: {
            userId,
            goalId: input.goalId,
            stageId: input.stageId ?? null,
            kind: input.kind,
            localDate: dateToDb(input.localDate),
            protocol: input.protocol,
            baselineFtpWatts: ftp?.value ?? null,
          },
        }),
      );
    });
  }

  patch(userId: string, id: string, input: AssessmentPatch, key: string) {
    return this.write(
      userId,
      key,
      { action: "PATCH", id, input },
      async (tx) => {
        const current = await this.get(userId, id, tx);
        if (current.version !== input.expectedVersion)
          throw new ConflictException({
            code: "ASSESSMENT_VERSION_CONFLICT",
            message: "测试已变化，请刷新后再提交，输入已保留",
          });
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        validateAssessmentResult(
          current,
          input,
          assessmentToday(user.timezone),
        );
        if (input.status === "POSTPONED") {
          if (!current.goalId || current.kind === "LEGACY")
            throw new BadRequestException({
              code: "LEGACY_ASSESSMENT",
              message: "旧版测试请跳过后重新安排",
            });
          await this.schedules.confirm(
            tx,
            userId,
            {
              goalId: current.goalId,
              stageId: current.stageId,
              localDate: input.localDate!,
              kind: current.kind as "FTP" | "POWER_DURATION" | "FIXED_ROUTE",
              protocol: current.protocol,
              excludeId: id,
            },
            input.previewToken,
            input.acknowledgeConflicts,
          );
        }
        const completed = input.status === "COMPLETED";
        const data: Prisma.TrainingAssessmentUpdateInput = {
          status: input.status,
          version: { increment: 1 },
          ...(input.status === "POSTPONED"
            ? { localDate: dateToDb(input.localDate!) }
            : {}),
          // Preserve historical evidence when marking an existing result invalid.
          ...(completed
            ? {
                protocol: input.protocol,
                actualDate: dateToDb(input.actualDate!),
                resultWatts: input.resultWatts ?? null,
                durationSeconds: input.durationSeconds ?? null,
                routeName: input.routeName ?? null,
                distanceKm: input.distanceKm ?? null,
                source: input.source,
                rpe: input.rpe,
                conditions: input.conditions ?? null,
                notes: input.notes ?? null,
                comparableConditions: input.comparableConditions ?? false,
              }
            : {
                reason: input.reason,
                ...(input.status === "INCOMPLETE"
                  ? {
                      actualDate: dateToDb(input.actualDate!),
                      conditions: input.conditions ?? null,
                      notes: input.notes ?? null,
                    }
                  : {}),
              }),
        };
        return assessmentResponse(
          await tx.trainingAssessment.update({
            where: { id, version: input.expectedVersion },
            data,
          }),
        );
      },
    );
  }

  latestFtp(db: Prisma.TransactionClient, userId: string) {
    return db.abilityMeasurement.findFirst({
      where: { userId, metricType: "FTP", unit: "W" },
      orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
    });
  }

  updateFtp(
    userId: string,
    id: string,
    input: AssessmentFtpInput,
    key: string,
  ) {
    return this.write(userId, key, { action: "FTP", id, input }, async (tx) => {
      const item = await this.get(userId, id, tx);
      if (item.version !== input.expectedVersion)
        throw new ConflictException({
          code: "ASSESSMENT_VERSION_CONFLICT",
          message: "测试已变化，请刷新复评后重试",
        });
      if (
        item.status !== "COMPLETED" ||
        item.kind !== "FTP" ||
        !item.actualDate ||
        !item.source ||
        !item.rpe ||
        !item.resultWatts ||
        item.ftpMeasurementId
      )
        throw new ConflictException({
          code: "ASSESSMENT_FTP_NOT_APPLICABLE",
          message: "仅有效且尚未应用的 FTP 测试可以更新 FTP",
        });
      const [latest, user] = await Promise.all([
        this.latestFtp(tx, userId),
        tx.user.findUniqueOrThrow({ where: { id: userId } }),
      ]);
      const actualDate = dbToDate(item.actualDate);
      if (
        (latest?.id ?? null) !== input.expectedFtpId ||
        (latest &&
          assessmentDateInZone(latest.measuredAt, user.timezone) > actualDate)
      )
        throw new ConflictException({
          code: "FTP_VERSION_CONFLICT",
          message: "已有更新的 FTP，请刷新复评；历史测试不能覆盖较新的测量",
        });
      const measuredAt = assessmentMeasurementTime(
        actualDate,
        user.timezone,
        latest?.measuredAt,
      );
      const measurement = await tx.abilityMeasurement.create({
        data: {
          userId,
          metricType: "FTP",
          unit: "W",
          value: item.resultWatts,
          measuredAt,
          source: "TEST",
          confidence: "USER_CONFIRMED",
        },
      });
      return assessmentResponse(
        await tx.trainingAssessment.update({
          where: { id, version: item.version },
          data: { ftpMeasurementId: measurement.id, version: { increment: 1 } },
        }),
      );
    });
  }
}

export function assessmentDateInZone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Date-only evidence is stored at local midnight. Same-day measurements retain
// monotonic ordering, while the original local date stays on the assessment.
function assessmentMeasurementTime(
  day: string,
  timezone: string,
  latest?: Date,
) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++)
    timestamp +=
      target -
      Date.parse(formatter.format(new Date(timestamp)).replace(" ", "T") + "Z");
  if (latest && assessmentDateInZone(latest, timezone) === day)
    timestamp = Math.max(timestamp, latest.getTime() + 1);
  if (
    timestamp > Date.now() ||
    assessmentDateInZone(new Date(timestamp), timezone) !== day
  )
    throw new ConflictException({
      code: "FTP_DATE_CONFLICT",
      message: "同日测量时间冲突，请稍后重试或在功率设置中更正",
    });
  return new Date(timestamp);
}
