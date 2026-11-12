import type { CalendarResponse } from "@ridepilot/contracts";

export function calendarDayActivity(
  date: string,
  data: {
    workouts: CalendarResponse["items"];
    events: NonNullable<CalendarResponse["events"]>;
    raceDates: string[];
    assessmentDates: string[];
  },
) {
  if (data.workouts.some((workout) => workout.scheduledDate === date))
    return "WORKOUT";
  if (data.raceDates.includes(date)) return "RACE";
  if (data.assessmentDates.includes(date)) return "ASSESSMENT";
  if (
    data.events.some(
      (event) => event.date === date && event.kind === "RECOVERY",
    )
  )
    return "RECOVERY";
  return "REST";
}
