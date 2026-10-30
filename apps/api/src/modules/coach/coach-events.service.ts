import { activityWorkoutId } from "../training/workout-activity";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ActivityInput,
  AssessmentInput,
  AssessmentPatch,
  RaceInput,
  RacePatch,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dateToDb, dbToDate } from "../training/training.validation";
import { CoachDataService } from "./coach-data.service";

@Injectable()
export class CoachEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: CoachDataService,
  ) {}

  async recordActivity(userId: string, input: ActivityInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const workout = await tx.workout.findFirst({
        where: {
          id: input.workoutId,
          planVersion: { activeForPlan: { userId, status: "ACTIVE" } },
        },
      });
      if (!workout)
        throw new NotFoundException({
          code: "WORKOUT_NOT_FOUND",
          message: "课程不存在",
        });
      if (dbToDate(workout.scheduledDate) !== input.localDate)
        throw new BadRequestException({
          code: "ACTIVITY_DATE_MISMATCH",
          message: "记录日期与课程日期不一致",
        });
      const existing = await tx.trainingActivity.findFirst({
        where: { userId, workoutId: activityWorkoutId(workout) },
      });
      if (existing)
        throw new ConflictException({
          code: "ACTIVITY_ALREADY_RECORDED",
          message: "该课程已有训练记录",
        });
      let record;
      try {
        record = await tx.trainingActivity.create({
          data: {
            userId,
            workoutId: activityWorkoutId(workout),
            localDate: dateToDb(input.localDate),
            status: input.status,
            durationMin: input.durationMin ?? null,
            rpe: input.rpe ?? null,
            fatigue: input.fatigue ?? null,
            notes: input.notes ?? null,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw new ConflictException({
            code: "ACTIVITY_ALREADY_RECORDED",
            message: "该课程已有训练记录",
          });
        throw error;
      }
      return this.activityResponse(record);
    });
  }

  async listActivities(userId: string) {
    const records = await this.prisma.trainingActivity.findMany({
      where: { userId },
      orderBy: { localDate: "desc" },
      take: 50,
    });
    return records.map((record) => this.activityResponse(record));
  }

  async createAssessment(userId: string, input: AssessmentInput) {
    if (input.goalId) await this.data.getGoal(userId, input.goalId);
    const item = await this.prisma.trainingAssessment.create({
      data: {
        userId,
        goalId: input.goalId ?? null,
        localDate: dateToDb(input.localDate),
        protocol: input.protocol,
      },
    });
    return this.assessmentResponse(item);
  }

  async listAssessments(userId: string) {
    const items = await this.prisma.trainingAssessment.findMany({
      where: { userId },
      orderBy: { localDate: "desc" },
      take: 50,
    });
    return items.map((item) => this.assessmentResponse(item));
  }

  async getAssessment(userId: string, id: string) {
    const item = await this.prisma.trainingAssessment.findFirst({
      where: { id, userId },
    });
    if (!item)
      throw new NotFoundException({
        code: "ASSESSMENT_NOT_FOUND",
        message: "测试不存在",
      });
    return item;
  }

  async patchAssessment(userId: string, id: string, input: AssessmentPatch) {
    const current = await this.getAssessment(userId, id);
    if (!["SCHEDULED", "POSTPONED"].includes(current.status))
      throw new ConflictException({
        code: "ASSESSMENT_NOT_EDITABLE",
        message: "测试状态不可修改",
      });
    if (input.status === "COMPLETED" && !input.resultWatts)
      throw new BadRequestException({
        code: "ASSESSMENT_RESULT_REQUIRED",
        message: "请填写测试结果",
      });
    if (input.status === "POSTPONED" && !input.localDate)
      throw new BadRequestException({
        code: "ASSESSMENT_DATE_REQUIRED",
        message: "请选择新的测试日期",
      });
    if (["SKIPPED", "INVALID"].includes(input.status) && !input.conditions)
      throw new BadRequestException({
        code: "ASSESSMENT_REASON_REQUIRED",
        message: "请填写原因",
      });
    const updated = await this.prisma.trainingAssessment.updateMany({
      where: {
        id,
        userId,
        version: input.expectedVersion,
        status: { in: ["SCHEDULED", "POSTPONED"] },
      },
      data: {
        status: input.status,
        localDate: input.localDate ? dateToDb(input.localDate) : undefined,
        resultWatts: input.status === "COMPLETED" ? input.resultWatts : null,
        conditions: input.conditions ?? null,
        version: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new ConflictException({
        code: "ASSESSMENT_VERSION_CONFLICT",
        message: "测试已更新，请重新读取",
      });
    return this.assessmentResponse(await this.getAssessment(userId, id));
  }

  async createRace(userId: string, input: RaceInput) {
    this.assertTimezone(input.timezone);
    const item = await this.prisma.trainingRace.create({
      data: {
        userId,
        name: input.name,
        localDate: dateToDb(input.localDate),
        timezone: input.timezone,
        distanceKm: input.distanceKm,
        priority: input.priority,
      },
    });
    return this.raceResponse(item);
  }

  async listRaces(userId: string) {
    const items = await this.prisma.trainingRace.findMany({
      where: { userId },
      orderBy: { localDate: "asc" },
      take: 100,
    });
    return items.map((item) => this.raceResponse(item));
  }

  async getRace(userId: string, id: string) {
    const item = await this.prisma.trainingRace.findFirst({
      where: { id, userId },
    });
    if (!item)
      throw new NotFoundException({
        code: "RACE_NOT_FOUND",
        message: "赛事不存在",
      });
    return item;
  }

  async patchRace(userId: string, id: string, input: RacePatch) {
    const current = await this.getRace(userId, id);
    if (current.status === "COMPLETED")
      throw new ConflictException({
        code: "RACE_NOT_EDITABLE",
        message: "已完成赛事不可修改",
      });
    if (input.timezone) this.assertTimezone(input.timezone);
    const { expectedVersion, localDate, ...fields } = input;
    const updated = await this.prisma.trainingRace.updateMany({
      where: { id, userId, version: expectedVersion },
      data: {
        ...fields,
        ...(localDate ? { localDate: dateToDb(localDate) } : {}),
        version: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new ConflictException({
        code: "RACE_VERSION_CONFLICT",
        message: "赛事已更新，请重新读取",
      });
    return this.raceResponse(await this.getRace(userId, id));
  }

  private assertTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      throw new BadRequestException({
        code: "INVALID_TIMEZONE",
        message: "时区无效",
      });
    }
  }

  private activityResponse(item: {
    id: string;
    workoutId: string | null;
    localDate: Date;
    status: string;
    durationMin: number | null;
    rpe: number | null;
    fatigue: number | null;
    notes: string | null;
  }) {
    return {
      id: item.id,
      workoutId: item.workoutId,
      localDate: dbToDate(item.localDate),
      status: item.status,
      durationMin: item.durationMin,
      rpe: item.rpe,
      fatigue: item.fatigue,
      notes: item.notes,
    };
  }
  private assessmentResponse(item: {
    id: string;
    goalId: string | null;
    localDate: Date;
    protocol: string;
    status: string;
    resultWatts: unknown;
    conditions: string | null;
    version: number;
  }) {
    return {
      id: item.id,
      goalId: item.goalId,
      localDate: dbToDate(item.localDate),
      protocol: item.protocol,
      status: item.status,
      resultWatts: item.resultWatts == null ? null : Number(item.resultWatts),
      conditions: item.conditions,
      version: item.version,
    };
  }
  private raceResponse(item: {
    id: string;
    name: string;
    localDate: Date;
    timezone: string;
    distanceKm: unknown;
    priority: string;
    status: string;
    version: number;
  }) {
    return {
      id: item.id,
      name: item.name,
      localDate: dbToDate(item.localDate),
      timezone: item.timezone,
      distanceKm: Number(item.distanceKm),
      priority: item.priority,
      status: item.status,
      version: item.version,
    };
  }
}
