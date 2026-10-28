export function localDateInTimezone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function nextMonday(date: string): string {
  const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return addDays(date, (8 - weekday) % 7 || 7);
}

export function targetDateAfterWeeks(date: string, weeks: number): string {
  return addDays(date, weeks * 7);
}
