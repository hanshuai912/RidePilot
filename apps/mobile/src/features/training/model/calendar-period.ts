import { addDays } from "./training";
export type CalendarView = "WEEK" | "MONTH";
export function calendarDays(anchor: string, view: CalendarView) {
  const first = view === "MONTH" ? `${anchor.slice(0, 7)}-01` : anchor;
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const from = addDays(first, -offset);
  return Array.from({ length: view === "MONTH" ? 42 : 7 }, (_, index) =>
    addDays(from, index),
  );
}
export function moveCalendar(
  anchor: string,
  view: CalendarView,
  direction: number,
) {
  if (view === "WEEK") return addDays(anchor, direction * 7);
  const date = new Date(`${anchor}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + direction);
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, end));
  return date.toISOString().slice(0, 10);
}
