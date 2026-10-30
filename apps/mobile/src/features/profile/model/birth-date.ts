export type BirthDateFieldProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export const earliestBirthDate = "1900-01-01";

export type BirthDateParts = { year: number; month: number; day: number };

export function birthDateParts(value: string): BirthDateParts {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function birthDateFromParts(value: BirthDateParts): string {
  return [value.year, value.month, value.day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

export function clampBirthDateParts(
  value: BirthDateParts,
  maximum: Date,
): BirthDateParts {
  const year = Math.min(maximum.getFullYear(), Math.max(1900, value.year));
  const month = Math.min(
    year === maximum.getFullYear() ? maximum.getMonth() + 1 : 12,
    Math.max(1, value.month),
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay =
    year === maximum.getFullYear() && month === maximum.getMonth() + 1
      ? Math.min(daysInMonth, maximum.getDate())
      : daysInMonth;
  return { year, month, day: Math.min(lastDay, Math.max(1, value.day)) };
}

export function birthDateOptions(value: BirthDateParts, maximum: Date) {
  const lastMonth =
    value.year === maximum.getFullYear() ? maximum.getMonth() + 1 : 12;
  const lastDay = clampBirthDateParts({ ...value, day: 31 }, maximum).day;
  return {
    years: Array.from(
      { length: maximum.getFullYear() - 1900 + 1 },
      (_, index) => 1900 + index,
    ),
    months: Array.from({ length: lastMonth }, (_, index) => index + 1),
    days: Array.from({ length: lastDay }, (_, index) => index + 1),
  };
}

// Date-only values must retain the selected day in the device's local timezone.
export function birthDateToLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function localDateToBirthDate(value: Date): string {
  return [
    String(value.getFullYear()).padStart(4, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isSelectableBirthDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= earliestBirthDate &&
    value <= localDateToBirthDate(new Date()) &&
    localDateToBirthDate(birthDateToLocalDate(value)) === value
  );
}

export function birthDateLabel(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year}年${month}月${day}日`;
}
