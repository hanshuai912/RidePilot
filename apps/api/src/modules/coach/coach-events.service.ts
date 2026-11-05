import { activityWorkoutId } from "../training/workout-activity";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ActivityInput,
  RaceInput,
  RacePatch,
  RaceResultInput,
} from "@ridepilot/contracts";
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
          type: input.type ?? "ROAD_RACE",
          elevationGainM: input.elevationGainM ?? null,
          priority: input.priority,
          intent: input.intent ?? "FINISH",
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

  async impactPreview(userId: string, id: string) {
    const race = await this.getRace(userId, id);
    const [plan, assessments, races] = await Promise.all([
      this.prisma.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: { include: { workouts: true } } },
      }),
      this.prisma.trainingAssessment.findMany({
        where: { userId, localDate: dateToDb(dbToDate(race.localDate)) },
      }),
      this.prisma.trainingRace.findMany({
        where: {
          userId,
          localDate: dateToDb(dbToDate(race.localDate)),
          id: { not: race.id },
          status: "CONFIRMED",
        },
      }),
    ]);
    const raceDate = dbToDate(race.localDate);
    const conflicts = [
      ...(plan?.activeVersion?.workouts ?? [])
        .filter((workout) => dbToDate(workout.scheduledDate) === raceDate)
        .map((workout) => ({
          date: raceDate,
          kind: "WORKOUT" as const,
          title: workout.title ?? "骑行训练",
          severity: "BLOCKER" as const,
        })),
      ...assessments.map((assessment) => ({
        date: raceDate,
        kind: "ASSESSMENT" as const,
        title: `阶段测试 · ${assessment.protocol}`,
        severity: "WARNING" as const,
      })),
      ...races.map((item) => ({
        date: raceDate,
        kind: "RACE" as const,
        title: `赛事 · ${item.name}`,
        severity:
          item.priority === "A" && race.priority === "A"
            ? ("BLOCKER" as const)
            : ("WARNING" as const),
      })),
    ];
    const affectedDates = new Set<string>([raceDate]);
    for (let offset = -7; offset <= 7; offset += 1) {
      const date = new Date(`${raceDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      affectedDates.add(date.toISOString().slice(0, 10));
    }
    return {
      race: this.raceResponse(race),
      conflicts,
      affectedDates: [...affectedDates].sort(),
      currentTrainingVersion: plan?.activeVersion?.versionNo ?? 0,
      requiresReplan: race.status === "CONFIRMED",
    };
  }

  async getRaceResult(userId: string, raceId: string) {
    await this.getRace(userId, raceId);
    const result = await this.prisma.trainingRaceResult.findFirst({
      where: { userId, raceId },
    });
    return result ? this.raceResultResponse(result) : null;
  }

  async saveRaceResult(userId: string, raceId: string, input: RaceResultInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const race = await this.getRace(userId, raceId, tx);
      if (race.status === "CANCELLED")
        throw new ConflictException({
          code: "RACE_NOT_COMPLETED",
          message: "已取消赛事不能录入结果",
        });
      const current = await tx.trainingRaceResult.findFirst({
        where: { userId, raceId },
      });
      if (
        input.expectedVersion !== undefined &&
        current &&
        input.expectedVersion !== current.version
      )
        throw new ConflictException({
          code: "RACE_RESULT_VERSION_CONFLICT",
          message: "赛事结果已更新，请重新读取",
        });
      const result = current
        ? await tx.trainingRaceResult.update({
            where: { id: current.id },
            data: {
              status: input.status,
              actualDate: dateToDb(input.actualDate),
              durationSeconds: input.durationSeconds ?? null,
              rpe: input.rpe ?? null,
              fatigue: input.fatigue ?? null,
              notes: input.notes ?? null,
              version: { increment: 1 },
            },
          })
        : await tx.trainingRaceResult.create({
            data: {
              raceId,
              userId,
              status: input.status,
              actualDate: dateToDb(input.actualDate),
              durationSeconds: input.durationSeconds ?? null,
              rpe: input.rpe ?? null,
              fatigue: input.fatigue ?? null,
              notes: input.notes ?? null,
            },
          });
      await tx.trainingRace.update({
        where: { id: raceId },
        data: { status: "COMPLETED", version: { increment: 1 } },
      });
      return this.raceResultResponse(result);
    });
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
    type: string;
    elevationGainM: number | null;
    priority: string;
    intent: string;
    status: string;
    version: number;
  }) {
    return {
      id: item.id,
      name: item.name,
      localDate: dbToDate(item.localDate),
      timezone: item.timezone,
      distanceKm: Number(item.distanceKm),
      type: item.type,
      elevationGainM: item.elevationGainM,
      priority: item.priority,
      intent: item.intent,
      status: item.status,
      version: item.version,
    };
  }

  private raceResultResponse(item: {
    id: string;
    raceId: string;
    status: string;
    actualDate: Date;
    durationSeconds: number | null;
    rpe: number | null;
    fatigue: number | null;
    notes: string | null;
    version: number;
  }) {
    return {
      id: item.id,
      raceId: item.raceId,
      status: item.status,
      actualDate: dbToDate(item.actualDate),
      durationSeconds: item.durationSeconds,
      rpe: item.rpe,
      fatigue: item.fatigue,
      notes: item.notes,
      version: item.version,
    };
  }
}
