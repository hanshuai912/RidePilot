import { BadRequestException, Injectable } from "@nestjs/common";
import { aiWeekOutputSchema, type AiWeekOutput } from "@ridepilot/contracts";

export interface WeeklyAvailabilitySlot {
  weekday: number;
  availableMinutes: number;
}

@Injectable()
export class CoachPlanValidator {
  validate(
    raw: unknown,
    input: {
      weekStartDate: string;
      endDate?: string;
      ftpWatts: number;
      weekdays: WeeklyAvailabilitySlot[];
      maxSessionMinutes: number;
      forbiddenDates?: string[];
      retainedMinutes?: Record<string, number>;
    },
  ): AiWeekOutput {
    const parsed = aiWeekOutputSchema.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException({
        code: "AI_OUTPUT_INVALID",
        message: "AI 课程结构无效",
      });
    const output = parsed.data;
    const start = new Date(`${input.weekStartDate}T00:00:00.000Z`);
    if (!input.endDate && start.getUTCDay() !== 1)
      throw new BadRequestException({
        code: "INVALID_WEEK_START",
        message: "周起始日必须是周一",
      });
    const end =
      input.endDate ??
      new Date(start.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
    const availability = new Map(
      input.weekdays.map((day) => [day.weekday, day.availableMinutes]),
    );
    const dailyMinutes = new Map<string, number>(
      Object.entries(input.retainedMinutes ?? {}),
    );
    const hardDays: string[] = [];
    if (!input.endDate && output.workouts.length > 14)
      throw new BadRequestException({
        code: "AI_OUTPUT_INVALID",
        message: "单周课程过多",
      });
    for (const workout of output.workouts) {
      if (
        workout.scheduledDate < input.weekStartDate ||
        workout.scheduledDate > end ||
        input.forbiddenDates?.includes(workout.scheduledDate)
      ) {
        throw new BadRequestException({
          code: "TRAINING_DATE_CONFLICT",
          message: "训练日期超出允许范围或与比赛、测试冲突",
        });
      }
      const weekday = new Date(
        `${workout.scheduledDate}T00:00:00.000Z`,
      ).getUTCDay();
      const minutesAllowed = availability.get(weekday);
      if (!minutesAllowed)
        throw new BadRequestException({
          code: "TRAINING_TIME_CONFLICT",
          message: "课程安排在不可训练日",
        });
      let minutes = 0;
      let hard = false;
      for (const segment of workout.segments) {
        if (segment.target.kind !== "duration")
          throw new BadRequestException({
            code: "AI_DURATION_REQUIRED",
            message: "AI 周计划区段须使用时长目标",
          });
        minutes += segment.target.value * (segment.repeatCount ?? 1);
        if (segment.intensity.max < segment.intensity.min)
          throw new BadRequestException({
            code: "INVALID_INTENSITY_RANGE",
            message: "功率范围无效",
          });
        const watts =
          segment.intensity.kind === "ftp_percent"
            ? Math.round((input.ftpWatts * segment.intensity.max) / 100)
            : segment.intensity.max;
        if (watts > input.ftpWatts * 1.5)
          throw new BadRequestException({
            code: "TRAINING_INTENSITY_BLOCKED",
            message: "训练强度超出当前安全规则",
          });
        if (segment.type === "work" && watts >= input.ftpWatts * 0.9)
          hard = true;
      }
      dailyMinutes.set(
        workout.scheduledDate,
        (dailyMinutes.get(workout.scheduledDate) ?? 0) + minutes,
      );
      if (
        minutes > input.maxSessionMinutes ||
        (dailyMinutes.get(workout.scheduledDate) ?? 0) > minutesAllowed
      ) {
        throw new BadRequestException({
          code: "TRAINING_TIME_CONFLICT",
          message: "课程超出可训练时长",
        });
      }
      if (hard) hardDays.push(workout.scheduledDate);
    }
    hardDays.sort();
    // Each eligible calendar week must be represented; otherwise a model may
    // silently generate only the first week of a multiweek request.
    if (input.endDate) {
      const eligibleWeeks = new Set<string>();
      const coveredWeeks = new Set<string>();
      const weekKey = (date: Date) =>
        new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86_400_000)
          .toISOString()
          .slice(0, 10);
      for (
        let day = new Date(start);
        day.toISOString().slice(0, 10) <= end;
        day = new Date(day.getTime() + 86_400_000)
      ) {
        if (
          availability.has(day.getUTCDay()) &&
          !input.forbiddenDates?.includes(day.toISOString().slice(0, 10))
        )
          eligibleWeeks.add(weekKey(day));
      }
      for (const workout of output.workouts)
        coveredWeeks.add(
          weekKey(new Date(`${workout.scheduledDate}T00:00:00Z`)),
        );
      if ([...eligibleWeeks].some((week) => !coveredWeeks.has(week)))
        throw new BadRequestException({
          code: "AI_OUTPUT_INVALID",
          message: "课程未覆盖所选范围中的全部可训练周",
        });
    }
    for (let i = 1; i < hardDays.length; i++) {
      const previous = Date.parse(`${hardDays[i - 1]}T00:00:00.000Z`);
      const current = Date.parse(`${hardDays[i]}T00:00:00.000Z`);
      if (current - previous === 86_400_000)
        throw new BadRequestException({
          code: "INSUFFICIENT_RECOVERY",
          message: "连续高强度训练缺少恢复",
        });
    }
    return output;
  }
}
