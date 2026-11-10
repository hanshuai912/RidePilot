export type DateParts = { year: number; month: number; day: number };

export function dateParts(value: string): DateParts {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function dateFromParts(value: DateParts): string {
  return [value.year, value.month, value.day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

export function datePickerLabel(value: string): string {
  const { year, month, day } = dateParts(value);
  return `${year}年${month}月${day}日`;
}

export function clampDateParts(
  value: DateParts,
  minimum: string,
  maximum?: string,
): DateParts {
  const month = Math.max(1, Math.min(12, value.month));
  const lastDay = new Date(Date.UTC(value.year, month, 0)).getUTCDate();
  const date = dateFromParts({
    year: value.year,
    month,
    day: Math.max(1, Math.min(lastDay, value.day)),
  });
  return dateParts(
    date < minimum ? minimum : maximum && date > maximum ? maximum : date,
  );
}

export function datePickerOptions(
  selection: DateParts,
  minimum: string,
  maximum?: string,
) {
  const min = dateParts(minimum);
  const max = maximum ? dateParts(maximum) : null;
  const firstMonth = selection.year === min.year ? min.month : 1;
  const lastMonth = max && selection.year === max.year ? max.month : 12;
  const firstDay =
    selection.year === min.year && selection.month === min.month ? min.day : 1;
  const lastDay =
    max && selection.year === max.year && selection.month === max.month
      ? max.day
      : new Date(Date.UTC(selection.year, selection.month, 0)).getUTCDate();
  const range = (first: number, last: number) =>
    Array.from({ length: last - first + 1 }, (_, index) => first + index);
  return {
    // Keep distant saved dates selectable; the unbounded picker offers a century.
    years: range(
      min.year,
      max?.year ?? Math.max(min.year + 100, selection.year),
    ),
    months: range(firstMonth, lastMonth),
    days: range(firstDay, lastDay),
  };
}
