import {
  validateStages,
  assertDateRange,
} from "../src/modules/coach/stage-plan.validation";
import { CoachPlanValidator } from "../src/modules/coach/coach-plan.validator";

const stage = {
  title: "基础阶段",
  purpose: "积累耐力",
  startDate: "2030-01-08",
  endDate: "2030-01-21",
  assessmentSuggestion: "结束时复评",
};
test("stage dates must cover the complete selected range without gaps or overlap", () => {
  expect(
    validateStages(
      { summary: "阶段安排", stages: [stage] },
      stage.startDate,
      stage.endDate,
    ).stages,
  ).toHaveLength(1);
  for (const stages of [
    [{ ...stage, startDate: "2030-01-09" }],
    [{ ...stage, endDate: "2030-01-20" }],
    [stage, stage],
  ])
    expect(() =>
      validateStages(
        { summary: "阶段安排", stages },
        stage.startDate,
        stage.endDate,
      ),
    ).toThrow();
});
test("generation ranges reject reversed dates and oversized requests", () => {
  expect(() => assertDateRange("2030-01-08", "2030-01-07", 84)).toThrow();
  expect(() => assertDateRange("2030-01-08", "2031-01-08", 84)).toThrow();
});
const workout = (date: string) => ({
  scheduledDate: date,
  title: "耐力骑行",
  purpose: "耐力",
  segments: [
    {
      type: "work",
      target: { kind: "duration", value: 30, unit: "min" },
      intensity: { kind: "ftp_percent", min: 60, max: 70 },
    },
  ],
});
test("arbitrary date ranges require courses in every eligible week and respect the exact boundary", () => {
  const validator = new CoachPlanValidator();
  const ctx = {
    weekStartDate: "2030-01-08",
    endDate: "2030-01-21",
    ftpWatts: 250,
    weekdays: [{ weekday: 2, availableMinutes: 60 }],
    maxSessionMinutes: 60,
  };
  const output = {
    summary: "跨周课程",
    stageSummary: "耐力",
    assessmentSuggestion: "复评",
    workouts: [workout("2030-01-08"), workout("2030-01-15")],
  };
  expect(validator.validate(output, ctx).workouts).toHaveLength(2);
  expect(() =>
    validator.validate({ ...output, workouts: [workout("2030-01-08")] }, ctx),
  ).toThrow("全部可训练周");
  expect(() =>
    validator.validate(
      { ...output, workouts: [...output.workouts, workout("2030-01-22")] },
      ctx,
    ),
  ).toThrow("超出允许范围");
  expect(
    validator.validate(
      { ...output, workouts: [workout("2030-01-08")] },
      { ...ctx, forbiddenDates: ["2030-01-15"] },
    ).workouts,
  ).toHaveLength(1);
});
