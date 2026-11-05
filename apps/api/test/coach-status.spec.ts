import { coachStatus, localCoachDate } from "../src/modules/coach/coach-status";
import type { TrainingActivity } from "../src/generated/prisma/client";

const feedback = (
  overrides: Partial<TrainingActivity> = {},
): TrainingActivity => ({
  id: "00000000-0000-4000-8000-000000000001",
  userId: "u",
  workoutId: null,
  localDate: new Date("2030-01-08"),
  status: "COMPLETED",
  durationMin: 60,
  rpe: 9,
  fatigue: null,
  notes: null,
  createdAt: new Date("2030-01-08"),
  ...overrides,
});
describe("coach evidence status", () => {
  it("uses the authenticated user's local day across UTC boundaries", () => {
    expect(
      localCoachDate(new Date("2030-01-08T23:30:00Z"), "Asia/Shanghai"),
    ).toBe("2030-01-09");
    expect(
      localCoachDate(new Date("2030-01-08T01:30:00Z"), "America/Los_Angeles"),
    ).toBe("2030-01-07");
  });
  it("never treats RPE or an empty history as recovery evidence", () => {
    expect(coachStatus("2030-01-09", [], [], [], null).code).toBe(
      "INSUFFICIENT",
    );
    const status = coachStatus("2030-01-09", [feedback()], [], [], null);
    expect(status.code).toBe("INSUFFICIENT");
    expect(status.evidence[0]).toMatchObject({
      date: "2030-01-08",
      detail: expect.stringContaining("RPE 9/10"),
    });
  });
  it("uses latest recent fatigue and ignores feedback older than three days", () => {
    expect(
      coachStatus("2030-01-09", [feedback({ fatigue: 8 })], [], [], null).code,
    ).toBe("RECOVERING");
    expect(
      coachStatus(
        "2030-01-09",
        [
          feedback({ fatigue: 2 }),
          feedback({ localDate: new Date("2030-01-07"), fatigue: 9 }),
        ],
        [],
        [],
        null,
      ).code,
    ).toBe("STABLE");
    expect(
      coachStatus("2030-01-12", [feedback({ fatigue: 2 })], [], [], null).code,
    ).toBe("INSUFFICIENT");
  });
});
