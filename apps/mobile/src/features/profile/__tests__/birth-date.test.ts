import {
  birthDateFromParts,
  birthDateOptions,
  birthDateParts,
  birthDateToLocalDate,
  clampBirthDateParts,
  isSelectableBirthDate,
  localDateToBirthDate,
} from "../model/birth-date";

test("preserves date-only values and rejects invalid dates", () => {
  expect(localDateToBirthDate(birthDateToLocalDate("2000-02-29"))).toBe(
    "2000-02-29",
  );
  expect(birthDateFromParts(birthDateParts("2000-02-29"))).toBe("2000-02-29");
  expect(isSelectableBirthDate("2000-02-29")).toBe(true);
  expect(isSelectableBirthDate("1900-01-01")).toBe(true);
  for (const value of [
    "1900-02-29",
    "2023-02-29",
    "1899-12-31",
    "2999-01-01",
    "not-a-date",
  ]) {
    expect(isSelectableBirthDate(value)).toBe(false);
  }
});

test("clamps long months and leap days to the last valid day", () => {
  const today = new Date(2026, 9, 29);
  expect(clampBirthDateParts({ year: 2000, month: 2, day: 31 }, today)).toEqual(
    { year: 2000, month: 2, day: 29 },
  );
  expect(clampBirthDateParts({ year: 1900, month: 2, day: 29 }, today)).toEqual(
    { year: 1900, month: 2, day: 28 },
  );
  expect(clampBirthDateParts({ year: 1990, month: 4, day: 31 }, today)).toEqual(
    { year: 1990, month: 4, day: 30 },
  );
});

test("year changes constrain future months and days to today", () => {
  const today = new Date(2026, 9, 29);
  expect(
    clampBirthDateParts({ year: 2026, month: 12, day: 31 }, today),
  ).toEqual({ year: 2026, month: 10, day: 29 });
  const options = birthDateOptions({ year: 2026, month: 10, day: 29 }, today);
  expect(options.years[0]).toBe(1900);
  expect(options.years.at(-1)).toBe(2026);
  expect(options.months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(options.days).toHaveLength(29);
  expect(
    birthDateOptions({ year: 2025, month: 12, day: 31 }, today).days,
  ).toHaveLength(31);
});
