import { addDays, nextMonday, targetDateAfterWeeks } from "../model/plan-dates";

test("chooses the next full training week and a concrete goal date", () => {
  expect(nextMonday("2026-10-26")).toBe("2026-11-02");
  expect(nextMonday("2026-10-29")).toBe("2026-11-02");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(targetDateAfterWeeks("2026-10-26", 8)).toBe("2026-12-21");
});
