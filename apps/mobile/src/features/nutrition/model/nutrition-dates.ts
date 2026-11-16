import { addDays } from "../../coach/model/plan-dates";

export const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

export function weekStart(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function monthRange(date: string): [string, string] {
  const first = `${date.slice(0, 7)}-01`;
  const end = new Date(`${first}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return [first, end.toISOString().slice(0, 10)];
}

export function shiftMonth(date: string, amount: number) {
  const next = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + amount);
  return next.toISOString().slice(0, 10);
}

export function dateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function shortDateLabel(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
}

export function calendarWeeks(month: string): (string | null)[][] {
  const [first, last] = monthRange(month);
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells = Array.from(
    { length: Math.ceil((offset + Number(last.slice(8))) / 7) * 7 },
    (_, index) => {
      const date = addDays(first, index - offset);
      return date >= first && date <= last ? date : null;
    },
  );
  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
}
