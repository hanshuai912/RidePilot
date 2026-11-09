import { parseTrainingAvailability } from "./training-availability";
import { ConflictException } from "@nestjs/common";
import { type ManualWorkoutDraft } from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";
import { assertEditableDate, dateToDb, dbToDate } from "./training.validation";

export type ScheduleContext = {
  slots: { weekday: number; availableMinutes: number }[] | null;
  maxSessionMinutes: number | null;
  races: string[];
  assessments: string[];
  workouts: { date: string; minutes: number | null; distance: boolean }[];
};
export function scheduleConflicts(
  context: ScheduleContext,
  draft: ManualWorkoutDraft,
): string[] {
  const conflicts: string[] = [];
  if (context.races.includes(draft.scheduledDate))
    conflicts.push("目标日期有比赛，请选择其他日期或先调整赛事安排");
  if (context.assessments.includes(draft.scheduledDate))
    conflicts.push("目标日期有阶段测试，请选择其他日期或先调整测试安排");
  const slot = context.slots?.find(
    (s) => s.weekday === dateToDb(draft.scheduledDate).getUTCDay(),
  );
  if (!context.slots) conflicts.push("请先设置可训练时间，再检查改期安排");
  else if (!slot) conflicts.push("目标日期是固定休息日，不在可训练时间内");
  const minutes = draft.segments.reduce(
    (sum, s) =>
      sum +
      (s.target.kind === "duration"
        ? s.target.value * (s.repeatCount ?? 1)
        : 0),
    0,
  );
  const retained = context.workouts.filter(
    (w) => w.date === draft.scheduledDate,
  );
  if (
    draft.segments.some((s) => s.target.kind === "distance") ||
    retained.some((w) => w.distance)
  )
    conflicts.push(
      "距离目标无法可靠换算时长，请先将当日课程改为时间目标再改期",
    );
  if (context.maxSessionMinutes !== null && minutes > context.maxSessionMinutes)
    conflicts.push("课程超过单次可训练时长，请先缩短课程");
  if (
    slot &&
    minutes + retained.reduce((sum, w) => sum + (w.minutes ?? 0), 0) >
      slot.availableMinutes
  )
    conflicts.push("目标日期的课程总时长超过当日可用时间");
  return conflicts;
}

export async function readSchedule(
  tx: Prisma.TransactionClient,
  userId: string,
  from: string,
  to: string,
  excludeWorkoutId: string,
): Promise<ScheduleContext> {
  const [availability, races, assessments, plan] = await Promise.all([
    tx.trainingAvailability.findUnique({ where: { userId } }),
    tx.trainingRace.findMany({
      where: {
        userId,
        status: "CONFIRMED",
        localDate: { gte: dateToDb(from), lte: dateToDb(to) },
      },
    }),
    tx.trainingAssessment.findMany({
      where: {
        userId,
        status: { in: ["SCHEDULED", "POSTPONED"] },
        localDate: { gte: dateToDb(from), lte: dateToDb(to) },
      },
    }),
    tx.trainingPlan.findFirst({
      where: { userId, status: "ACTIVE" },
      include: {
        activeVersion: {
          include: {
            workouts: {
              where: {
                id: { not: excludeWorkoutId },
                scheduledDate: { gte: dateToDb(from), lte: dateToDb(to) },
              },
            },
          },
        },
      },
    }),
  ]);
  const parsed = parseTrainingAvailability(availability);
  return {
    slots: parsed.success ? parsed.data.weekdays : null,
    maxSessionMinutes: parsed.success ? parsed.data.maxSessionMinutes : null,
    races: races.map((r) => dbToDate(r.localDate)),
    assessments: assessments.map((a) => dbToDate(a.localDate)),
    workouts: (plan?.activeVersion?.workouts ?? []).map((w) => ({
      date: dbToDate(w.scheduledDate),
      minutes: w.timeTargetMin ? Number(w.timeTargetMin) : null,
      distance: !!w.distanceTargetKm,
    })),
  };
}

export async function assertReschedule(
  tx: Prisma.TransactionClient,
  userId: string,
  draft: ManualWorkoutDraft,
  original: { id: string; scheduledDate: string } | null,
  timezone: string,
) {
  if (!original || original.scheduledDate === draft.scheduledDate) return;
  assertEditableDate(original.scheduledDate, timezone);
  assertEditableDate(draft.scheduledDate, timezone);
  const context = await readSchedule(
    tx,
    userId,
    draft.scheduledDate,
    draft.scheduledDate,
    original.id,
  );
  const conflicts = scheduleConflicts(context, draft);
  if (conflicts.length)
    throw new ConflictException({
      code: "WORKOUT_SCHEDULE_CONFLICT",
      message: conflicts.join("；"),
    });
}
