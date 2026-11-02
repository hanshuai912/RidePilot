import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AssessmentPreviewInput,
  AssessmentPreview,
} from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dateToDb } from "../training/training.validation";

export function assessmentToday(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function assessmentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

@Injectable()
export class AssessmentScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    userId: string,
    input: AssessmentPreviewInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<AssessmentPreview> {
    const [goal, user, ftp, stage] = await Promise.all([
      db.trainingGoal.findFirst({ where: { id: input.goalId, userId } }),
      db.user.findUniqueOrThrow({ where: { id: userId } }),
      db.abilityMeasurement.findFirst({
        where: { userId, metricType: "FTP", unit: "W" },
        orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
      }),
      input.stageId
        ? db.trainingStage.findFirst({
            where: {
              id: input.stageId,
              stagePlan: { userId, goalId: input.goalId },
            },
            include: { stagePlan: true },
          })
        : null,
    ]);
    if (!goal || (input.stageId && !stage))
      throw new NotFoundException({
        code: "ASSESSMENT_CONTEXT_NOT_FOUND",
        message: "目标或阶段不存在",
      });
    if (
      !input.excludeId &&
      (goal.status !== "ACTIVE" ||
        (stage &&
          (stage.stagePlan.status !== "ACTIVE" ||
            stage.stagePlan.goalVersion !== goal.version ||
            stage.stagePlan.ftpMeasurementId !== ftp?.id)))
    )
      throw new ConflictException({
        code: "STAGE_PLAN_STALE",
        message: "目标或阶段已变化，请重新选择",
      });
    if (!ftp)
      throw new BadRequestException({
        code: "FTP_REQUIRED",
        message: "请先设置 FTP，再安排测试",
      });
    if (input.localDate < assessmentToday(user.timezone))
      throw new BadRequestException({
        code: "ASSESSMENT_DATE_IN_PAST",
        message: "请选择今天或未来的测试日期",
      });
    if (input.excludeId) {
      const current = await db.trainingAssessment.findFirst({
        where: { id: input.excludeId, userId },
      });
      if (
        !current ||
        current.goalId !== input.goalId ||
        current.stageId !== (input.stageId ?? null) ||
        current.kind !== input.kind ||
        current.protocol !== input.protocol
      )
        throw new NotFoundException({
          code: "ASSESSMENT_NOT_FOUND",
          message: "测试不存在或安排已变化",
        });
    }
    const date = dateToDb(input.localDate);
    const [workouts, races, tests] = await Promise.all([
      db.workout.findMany({
        where: {
          scheduledDate: date,
          planVersion: { activeForPlan: { userId, status: "ACTIVE" } },
        },
        orderBy: { id: "asc" },
      }),
      db.trainingRace.findMany({
        where: { userId, localDate: date, status: "CONFIRMED" },
        orderBy: { id: "asc" },
      }),
      db.trainingAssessment.findMany({
        where: {
          userId,
          localDate: date,
          status: { in: ["SCHEDULED", "POSTPONED"] },
          ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
        },
        orderBy: { id: "asc" },
      }),
    ]);
    const conflicts: AssessmentPreview["conflicts"] = [
      ...workouts.map((item) => ({
        id: item.id,
        type: "WORKOUT" as const,
        title: item.title ?? "骑行课程",
      })),
      ...races.map((item) => ({
        id: item.id,
        type: "RACE" as const,
        title: item.name,
      })),
      ...tests.map((item) => ({
        id: item.id,
        type: "ASSESSMENT" as const,
        title: item.protocol,
      })),
    ];
    return {
      conflicts,
      token: assessmentHash({
        userId,
        goalVersion: goal.version,
        stageVersion: stage?.stagePlan.version,
        ftpId: ftp.id,
        date: input.localDate,
        kind: input.kind,
        protocol: input.protocol,
        stageId: input.stageId ?? null,
        goalId: input.goalId,
        excludeId: input.excludeId ?? null,
        conflicts,
        eventVersions: [...races, ...tests].map((item) => item.version),
      }),
    };
  }

  async confirm(
    db: Prisma.TransactionClient,
    userId: string,
    input: AssessmentPreviewInput,
    token?: string,
    acknowledge?: boolean,
  ) {
    const preview = await this.preview(userId, input, db);
    if (preview.token !== token)
      throw new ConflictException({
        code: "ASSESSMENT_PREVIEW_STALE",
        message: "安排已变化，请重新预览冲突后确认",
      });
    if (preview.conflicts.length && !acknowledge)
      throw new ConflictException({
        code: "ASSESSMENT_CONFLICT_CONFIRMATION_REQUIRED",
        message: "请确认同日已有安排，或选择其他日期",
      });
  }
}
