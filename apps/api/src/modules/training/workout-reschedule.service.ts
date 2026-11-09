import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  rescheduleInputSchema,
  type RescheduleInput,
  type ReschedulePreview,
} from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TrainingRepository } from "./training.repository";
import { toDraft } from "./training.mapper";
import { readSchedule, scheduleConflicts } from "./workout-schedule";
import {
  assertEditableDate,
  assertPlanVersion,
  dateToDb,
  dbToDate,
} from "./training.validation";
@Injectable()
export class WorkoutRescheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: TrainingRepository,
  ) {}
  async preview(
    userId: string,
    workoutId: string,
    input: RescheduleInput,
  ): Promise<ReschedulePreview> {
    rescheduleInputSchema.parse(input);
    const workout = await this.repository.findWorkout(userId, workoutId);
    if (
      !workout ||
      workout.planVersion.plan.activeVersionId !== workout.planVersionId
    )
      throw new NotFoundException({
        code: "WORKOUT_NOT_FOUND",
        message: "训练课程不存在或已变化",
      });
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    assertEditableDate(dbToDate(workout.scheduledDate), timezone);
    assertEditableDate(input.scheduledDate, timezone);
    assertPlanVersion(input.expectedPlanVersion, workout.planVersion.versionNo);
    if ((await this.repository.activities(userId, [workout])).size)
      throw new ConflictException({
        code: "WORKOUT_ALREADY_RECORDED",
        message: "课程已有记录，不可改期",
      });
    const end = new Date(
      dateToDb(input.scheduledDate).getTime() + 14 * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const context = await readSchedule(
      this.prisma,
      userId,
      input.scheduledDate,
      end,
      workoutId,
    );
    const draft = { ...toDraft(workout), scheduledDate: input.scheduledDate };
    const alternatives: ReschedulePreview["alternatives"] = [];
    for (let offset = 1; offset <= 14 && alternatives.length < 3; offset++) {
      const date = new Date(
        dateToDb(input.scheduledDate).getTime() + offset * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      if (
        date === dbToDate(workout.scheduledDate) ||
        scheduleConflicts(context, { ...draft, scheduledDate: date }).length
      )
        continue;
      const budget = context.slots!.find(
        (slot) => slot.weekday === dateToDb(date).getUTCDay(),
      )!.availableMinutes;
      alternatives.push({
        date,
        availableMinutes:
          budget -
          context.workouts
            .filter((w) => w.date === date)
            .reduce((sum, w) => sum + (w.minutes ?? 0), 0),
      });
    }
    return {
      workoutId,
      planVersion: workout.planVersion.versionNo,
      from: dbToDate(workout.scheduledDate),
      to: input.scheduledDate,
      conflicts:
        input.scheduledDate === dbToDate(workout.scheduledDate)
          ? ["请选择与原课程不同的日期"]
          : scheduleConflicts(context, draft),
      alternatives,
    };
  }
}
