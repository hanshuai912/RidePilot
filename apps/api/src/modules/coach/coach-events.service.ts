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
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true },
      });
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: user.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      if (input.actualDate > today)
        throw new BadRequestException({
          code: "FUTURE_RACE_RESULT",
          message: "不能记录未来比赛结果，请填写实际完成日期",
        });
      const current = await tx.trainingRaceResult.findFirst({
        where: { userId, raceId },
      });
      if (
        current &&
        current.status === input.status &&
        dbToDate(current.actualDate) === input.actualDate &&
        current.durationSeconds === (input.durationSeconds ?? null) &&
        current.rpe === (input.rpe ?? null) &&
        current.fatigue === (input.fatigue ?? null) &&
        current.notes === (input.notes ?? null)
      )
        return this.raceResultResponse(current);
      if (
        (current && input.expectedVersion !== current.version) ||
        (!current && input.expectedVersion !== undefined)
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
      await this.invalidateRaceDrafts(tx, userId, raceId);
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
      await this.invalidateRaceDrafts(tx, userId, id);
      return this.raceResponse(await this.getRace(userId, id, tx));
    });
  }

  private async invalidateRaceDrafts(
    tx: Prisma.TransactionClient,
    userId: string,
    raceId: string,
  ) {
    const linked = {
      userId,
      OR: [
        {
          scene: "RACE_REPLAN",
          input: { path: ["relatedId"], equals: raceId },
        },
        {
          scene: "NUTRITION_PLAN",
          input: { path: ["raceId"], equals: raceId },
        },
      ],
    };
    await tx.aiGeneration.updateMany({
      where: { ...linked, status: { in: ["QUEUED", "RUNNING"] } },
      data: {
        status: "FAILED",
        errorCode: "RACE_VERSION_CONFLICT",
        leaseUntil: null,
      },
    });
    const jobs = await tx.aiGeneration.findMany({
      where: linked,
      select: { proposalId: true, scene: true },
    });
    const mutable: ("DRAFT" | "READY" | "BLOCKED")[] = [
      "DRAFT",
      "READY",
      "BLOCKED",
    ];
    await tx.changeProposal.updateMany({
      where: {
        userId,
        status: { in: mutable },
        id: {
          in: jobs
            .filter((job) => job.scene === "RACE_REPLAN")
            .flatMap((job) => (job.proposalId ? [job.proposalId] : [])),
        },
      },
      data: { status: "EXPIRED" },
    });
    await tx.nutritionProposal.updateMany({
      where: {
        userId,
        status: { in: mutable },
        id: {
          in: jobs
            .filter((job) => job.scene === "NUTRITION_PLAN")
            .flatMap((job) => (job.proposalId ? [job.proposalId] : [])),
        },
      },
      data: { status: "EXPIRED" },
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
