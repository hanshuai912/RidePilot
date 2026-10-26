import { CoachPlanValidator } from "../src/modules/coach/coach-plan.validator";

const week = {
  summary: "基础骑行周",
  stageSummary: "建立规律训练",
  assessmentSuggestion: "阶段结束后复评 FTP",
  workouts: [
    {
      scheduledDate: "2030-01-07",
      title: "耐力骑行",
      purpose: "提高耐力",
      segments: [
        {
          type: "warmup",
          target: { kind: "duration", value: 10, unit: "min" },
          intensity: { kind: "ftp_percent", min: 45, max: 55 },
        },
        {
          type: "work",
          target: { kind: "duration", value: 40, unit: "min" },
          intensity: { kind: "ftp_percent", min: 60, max: 75 },
        },
        {
          type: "cooldown",
          target: { kind: "duration", value: 10, unit: "min" },
          intensity: { kind: "ftp_percent", min: 40, max: 50 },
        },
      ],
    },
  ],
};

describe("CoachPlanValidator", () => {
  const validator = new CoachPlanValidator();
  const context = {
    weekStartDate: "2030-01-07",
    ftpWatts: 250,
    weekdays: [{ weekday: 1, availableMinutes: 90 }],
    maxSessionMinutes: 90,
  };

  it("accepts a structured workout within availability", () => {
    expect(validator.validate(week, context).workouts).toHaveLength(1);
  });

  it("blocks unavailable dates and excessive duration", () => {
    expect(() =>
      validator.validate(week, { ...context, forbiddenDates: ["2030-01-07"] }),
    ).toThrow();
    expect(() =>
      validator.validate(week, { ...context, maxSessionMinutes: 30 }),
    ).toThrow();
  });

  it("blocks invalid model structure", () => {
    expect(() =>
      validator.validate(
        { ...week, workouts: [{ ...week.workouts[0], segments: [] }] },
        context,
      ),
    ).toThrow();
  });
});
