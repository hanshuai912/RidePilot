import { activityWorkoutId } from "../training/workout-activity";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ActivityInput, RaceInput, RacePatch } from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dateToDb, dbToDate } from "../training/training.validation";

@Injectable()
export class CoachEventsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createRace(userId: string, input: RaceInput) {
    this.assertTimezone(input.timezone);
    const item = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      return tx.trainingRace.create({
        data: {
          userId,
          name: input.name,
          localDate: dateToDb(input.localDate),
          timezone: input.timezone,
          distanceKm: input.distanceKm,
          priority: input.priority,
        },
      });
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

  async getRace(
    userId: string,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const item = await db.trainingRace.findFirst({
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
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const current = await this.getRace(userId, id, tx);
      if (current.status === "COMPLETED")
        throw new ConflictException({
          code: "RACE_NOT_EDITABLE",
          message: "已完成赛事不可修改",
        });
      if (input.timezone) this.assertTimezone(input.timezone);
      const { expectedVersion, localDate, ...fields } = input;
      const updated = await tx.trainingRace.updateMany({
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
      return this.raceResponse(await this.getRace(userId, id, tx));
    });
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
