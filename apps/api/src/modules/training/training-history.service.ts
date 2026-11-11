import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  trainingHistoryCursorSchema,
  trainingHistoryQuerySchema,
  trainingHistoryResponseSchema,
  type TrainingHistoryCursor,
} from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TrainingHistoryRepository } from "./training-history.repository";
import { localCoachDate } from "../coach/coach-status";
import { toSummary } from "./training.mapper";
import { dbToDate } from "./training.validation";
import { workoutActivities } from "./workout-activity";

@Injectable()
export class TrainingHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: TrainingHistoryRepository,
  ) {}

  async list(userId: string, rawCursor?: string) {
    const cursor = this.cursor(rawCursor);
    return this.prisma.$transaction(
      async (db) => {
        const user = await db.user.findUniqueOrThrow({
          where: { id: userId },
          select: { timezone: true },
        });
        const today = localCoachDate(new Date(), user.timezone);
        const rows = await this.repository.page(db, userId, today, cursor, 21);
        const page = rows.slice(0, 20);
        const activities = await workoutActivities(db, userId, page);
        const last = page.at(-1);
        return trainingHistoryResponseSchema.parse({
          timezone: user.timezone,
          localDate: today,
          items: page.map((w) =>
            toSummary({
              ...w,
              editable: false,
              activity: activities.get(w.id) ?? null,
            }),
          ),
          nextCursor:
            rows.length > 20 && last
              ? Buffer.from(
                  JSON.stringify({
                    date: dbToDate(last.scheduledDate),
                    dayOrder: last.dayOrder,
                    id: last.id,
                  }),
                ).toString("base64url")
              : null,
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }

  async detail(userId: string, workoutId: string) {
    if (!trainingHistoryCursorSchema.shape.id.safeParse(workoutId).success)
      throw new NotFoundException({
        code: "WORKOUT_NOT_FOUND",
        message: "历史训练不存在",
      });
    return this.prisma.$transaction(
      async (db) => {
        const user = await db.user.findUniqueOrThrow({
          where: { id: userId },
          select: { timezone: true },
        });
        const workout = await this.repository.detail(
          db,
          userId,
          workoutId,
          localCoachDate(new Date(), user.timezone),
        );
        if (!workout)
          throw new NotFoundException({
            code: "WORKOUT_NOT_FOUND",
            message: "历史训练不存在",
          });
        const activities = await workoutActivities(db, userId, [workout]);
        return toSummary({
          ...workout,
          editable: false,
          activity: activities.get(workout.id) ?? null,
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }

  private cursor(rawCursor: string | undefined): TrainingHistoryCursor | null {
    try {
      trainingHistoryQuerySchema.parse({ cursor: rawCursor });
      if (!rawCursor) return null;
      return trainingHistoryCursorSchema.parse(
        JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8")),
      );
    } catch {
      throw new BadRequestException({
        code: "INVALID_HISTORY_CURSOR",
        message: "历史分页参数无效，请重新打开训练历史",
      });
    }
  }
}
