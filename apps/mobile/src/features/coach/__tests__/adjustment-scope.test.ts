import type { CalendarResponse } from "@ridepilot/contracts";
import { resolveAdjustmentScope } from "../services/adjustment-scope";
import { trainingApi } from "../../training/services/training.api";
jest.mock("../../training/services/training.api", () => ({
  trainingApi: { getCalendar: jest.fn(), getNextWorkout: jest.fn() },
}));
const api = jest.mocked(trainingApi);
const course: CalendarResponse["items"][number] = {
  id: "next",
  planVersion: 7,
  sportType: "cycling",
  source: "ai",
  title: "耐力训练",
  purpose: null,
  scheduledDate: "2026-12-08",
  dayOrder: 2,
  timeTargetMinutes: 30,
  distanceTargetKm: null,
  segments: [],
  editable: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  api.getNextWorkout.mockResolvedValue(course);
  api.getCalendar.mockResolvedValue({
    from: "2026-10-26",
    to: "2026-11-01",
    ftpAvailable: true,
    items: [course],
  });
});
test("next workout uses its exact identity and week even beyond the next week", async () => {
  await expect(
    resolveAdjustmentScope("token", "NEXT_WORKOUT", "2026-10-30"),
  ).resolves.toEqual({
    mode: "replace_workout",
    weekStartDate: "2026-12-07",
    targetWorkoutId: "next",
    expectedPlanVersion: 7,
  });
  expect(api.getCalendar).not.toHaveBeenCalled();
});
test.each([
  null,
  {
    ...course,
    activity: {
      id: "record",
      status: "COMPLETED" as const,
      durationMin: 30,
      rpe: null,
      fatigue: null,
      notes: null,
    },
  },
  { ...course, editable: false },
])(
  "no eligible next workout never falls back to a week adjustment: %s",
  async (value) => {
    api.getNextWorkout.mockResolvedValue(value);
    await expect(
      resolveAdjustmentScope("token", "NEXT_WORKOUT", "2026-10-30"),
    ).rejects.toThrow();
    expect(api.getCalendar).not.toHaveBeenCalled();
  },
);
test.each([
  ["2026-10-26", "THIS_WEEK", "2026-10-26", "2026-11-01"],
  ["2026-11-01", "THIS_WEEK", "2026-10-26", "2026-11-01"],
  ["2026-10-26", "NEXT_WEEK", "2026-11-02", "2026-11-08"],
  ["2026-11-01", "NEXT_WEEK", "2026-11-02", "2026-11-08"],
] as const)(
  "%s %s queries precisely the intended week",
  async (today, scope, from, to) => {
    await expect(
      resolveAdjustmentScope("token", scope, today),
    ).resolves.toMatchObject({ mode: "replace_week", weekStartDate: from });
    expect(api.getCalendar).toHaveBeenCalledWith("token", from, to);
  },
);
test("past and recorded courses do not make an otherwise empty week replaceable", async () => {
  api.getCalendar.mockResolvedValue({
    from: "2026-10-26",
    to: "2026-11-01",
    ftpAvailable: true,
    items: [
      { ...course, scheduledDate: "2026-10-29" },
      {
        ...course,
        scheduledDate: "2026-10-30",
        activity: {
          id: "record",
          status: "SKIPPED",
          durationMin: null,
          rpe: null,
          fatigue: null,
          notes: null,
        },
      },
    ],
  });
  await expect(
    resolveAdjustmentScope("token", "THIS_WEEK", "2026-10-30"),
  ).resolves.toEqual({
    mode: "empty_week",
    weekStartDate: "2026-10-26",
    expectedPlanVersion: 7,
  });
});
test("cycle explicitly rejects instead of silently adjusting a week", async () => {
  await expect(
    resolveAdjustmentScope("token", "CYCLE", "2026-10-30"),
  ).rejects.toThrow("暂未开放");
  expect(api.getCalendar).not.toHaveBeenCalled();
  expect(api.getNextWorkout).not.toHaveBeenCalled();
});
