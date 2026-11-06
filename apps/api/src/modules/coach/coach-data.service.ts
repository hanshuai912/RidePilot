import { GoalLifecycleService } from "./goals/goal-lifecycle.service";
import { goalResponse } from "./goals/goal-lifecycle.repository";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AvailabilityInput,
  FtpMeasurementInput,
  GoalInput,
  GoalPatch,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class CoachDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goals: GoalLifecycleService,
  ) {}

  async latestFtp(userId: string) {
    return this.prisma.abilityMeasurement.findFirst({
      where: { userId, metricType: "FTP", unit: "W" },
      orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
    });
  }

  async getFtp(userId: string) {
    const ftp = await this.latestFtp(userId);
    return ftp
      ? {
          id: ftp.id,
          valueWatts: Number(ftp.value),
          measuredAt: ftp.measuredAt.toISOString(),
          source: ftp.source,
        }
      : null;
  }

  async addFtp(userId: string, input: FtpMeasurementInput) {
    const measuredAt = new Date(input.measuredAt);
    if (measuredAt.getTime() > Date.now())
      throw new BadRequestException({
        code: "FTP_DATE_IN_FUTURE",
        message: "FTP 测量日期不能晚于当前时间",
      });
    const ftp = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      return tx.abilityMeasurement.create({
        data: {
          userId,
          metricType: "FTP",
          unit: "W",
          value: input.valueWatts,
          measuredAt,
          source: input.source,
        },
      });
    });
    return {
      id: ftp.id,
      valueWatts: Number(ftp.value),
      measuredAt: ftp.measuredAt.toISOString(),
      source: ftp.source,
    };
  }

  async getAvailability(userId: string) {
    const value = await this.prisma.trainingAvailability.findUnique({
      where: { userId },
    });
    return value
      ? {
          timezone: value.timezone,
          weekdays: value.weekdays,
          maxSessionMinutes: value.maxSessionMinutes,
          version: value.version,
        }
      : null;
  }

  async putAvailability(userId: string, input: AvailabilityInput) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone });
    } catch {
      throw new BadRequestException({
        code: "INVALID_TIMEZONE",
        message: "时区无效",
      });
    }
    if (
      new Set(input.weekdays.map((slot) => slot.weekday)).size !==
      input.weekdays.length
    ) {
      throw new BadRequestException({
        code: "DUPLICATE_WEEKDAY",
        message: "同一星期不可重复",
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    if (user.timezone !== input.timezone)
      throw new ConflictException({
        code: "TIMEZONE_MISMATCH",
        message: "请先在个人资料中更新时区",
      });
    const current = await this.prisma.trainingAvailability.findUnique({
      where: { userId },
    });
    if (current && input.expectedVersion !== current.version)
      throw new ConflictException({
        code: "AVAILABILITY_VERSION_CONFLICT",
        message: "训练时间已更改，请重新读取",
      });
    if (!current && input.expectedVersion !== undefined)
      throw new ConflictException({
        code: "AVAILABILITY_VERSION_CONFLICT",
        message: "训练时间已更改，请重新读取",
      });
    if (current) {
      const updated = await this.prisma.trainingAvailability.updateMany({
        where: { userId, version: current.version },
        data: {
          weekdays: input.weekdays,
          maxSessionMinutes: input.maxSessionMinutes,
          version: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new ConflictException({
          code: "AVAILABILITY_VERSION_CONFLICT",
          message: "训练时间已更改，请重新读取",
        });
    } else {
      try {
        await this.prisma.trainingAvailability.create({
          data: {
            userId,
            timezone: input.timezone,
            weekdays: input.weekdays,
            maxSessionMinutes: input.maxSessionMinutes,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw new ConflictException({
            code: "AVAILABILITY_VERSION_CONFLICT",
            message: "训练时间已更改，请重新读取",
          });
        throw error;
      }
    }
    return this.getAvailability(userId);
  }

  createGoal(userId: string, input: GoalInput, key?: string) {
    return this.goals.create(userId, input, key);
  }

  async listGoals(userId: string) {
    const goals = await this.prisma.trainingGoal.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
    });
    return goals.map((goal) => goalResponse(goal));
  }

  async getGoal(userId: string, goalId: string) {
    const goal = await this.prisma.trainingGoal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal)
      throw new NotFoundException({
        code: "GOAL_NOT_FOUND",
        message: "目标不存在",
      });
    return goal;
  }

  patchGoal(userId: string, goalId: string, input: GoalPatch) {
    return this.goals.patch(userId, goalId, input);
  }

  async activePlan(userId: string) {
    return this.prisma.trainingPlan.findFirst({
      where: { userId, status: "ACTIVE", activeVersionId: { not: null } },
      include: { activeVersion: { include: { workouts: true } } },
    });
  }

  async readiness(userId: string) {
    const [ftp, availability, goal, profile, plan] = await Promise.all([
      this.latestFtp(userId),
      this.prisma.trainingAvailability.findUnique({ where: { userId } }),
      this.prisma.trainingGoal.findFirst({
        where: { userId, status: "ACTIVE" },
      }),
      this.prisma.athleteProfile.findUnique({ where: { userId } }),
      this.activePlan(userId),
    ]);
    const missingFields: string[] = [];
    if (!ftp || Number(ftp.value) <= 0) missingFields.push("ftp");
    if (!goal) missingFields.push("goal");
    if (!availability) missingFields.push("availability");
    if (!profile?.experienceLevel) missingFields.push("experienceLevel");
    if (goal?.targetWkg && !profile?.weightKg) missingFields.push("weightKg");
    return {
      ready: missingFields.length === 0,
      missingFields,
      activePlanVersion: plan?.activeVersion?.versionNo ?? 0,
    };
  }
}
