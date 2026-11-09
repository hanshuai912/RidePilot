import {
  workoutSegmentSchema,
  type CalendarResponse,
} from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";

export function workoutSegments(structure: Prisma.JsonValue) {
  const raw =
    structure && typeof structure === "object" && !Array.isArray(structure)
      ? structure.segments
      : null;
  const result = workoutSegmentSchema.array().safeParse(raw);
  return result.success ? result.data : [];
}

export function calendarEvents(
  from: string,
  to: string,
  weekdays: { weekday: number }[] | null,
  workouts: CalendarResponse["items"],
): NonNullable<CalendarResponse["events"]> {
  const events: NonNullable<CalendarResponse["events"]> = [];
  // Missing availability means unknown, never an inferred rest prescription.
  if (weekdays) {
    for (
      let cursor = new Date(`${from}T00:00:00Z`);
      cursor.toISOString().slice(0, 10) <= to;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const date = cursor.toISOString().slice(0, 10);
      if (
        !weekdays.some((slot) => slot.weekday === cursor.getUTCDay()) &&
        !workouts.some((w) => w.scheduledDate === date)
      )
        events.push({
          id: `rest-${date}`,
          date,
          kind: "REST",
          title: "固定休息日 · 可训练时间设置",
          source: "AVAILABILITY",
        });
    }
  }
  for (const workout of workouts) {
    if (
      workout.segments.some((s) => s.type === "recovery") &&
      workout.segments.every((s) => s.type !== "work")
    )
      events.push({
        id: `recovery-${workout.id}`,
        date: workout.scheduledDate,
        kind: "RECOVERY",
        title: workout.title || "恢复课程",
        source: "WORKOUT",
      });
  }
  return events;
}
