import type { AiWeekOutput } from "@ridepilot/contracts";
import { updateAiProposalSchema } from "@ridepilot/contracts";
import {
  buildCourseStagePlan,
  type CourseStageContext,
} from "../src/modules/coach/course-stage-planning";

const stage = {
  title: "基础阶段",
  purpose: "积累耐力",
  assessmentSuggestion: "比较训练反馈",
  startDate: "2030-01-07",
  endDate: "2030-01-13",
};
const output: AiWeekOutput = {
  summary: "本周耐力课程",
  stageSummary: "分期积累耐力",
  assessmentSuggestion: "阶段复评",
  workouts: [
    {
      scheduledDate: "2030-01-07",
      title: "耐力课",
      purpose: "基础耐力",
      segments: [
        {
          type: "work",
          target: { kind: "duration", value: 30, unit: "min" },
          intensity: { kind: "ftp_percent", min: 60, max: 70 },
        },
      ],
    },
  ],
};
const context: CourseStageContext = {
  basePlans: [],
  action: "CREATE",
  startDate: stage.startDate,
  endDate: stage.endDate,
};

test("builds structured stages and rejects gaps, overlaps and out-of-scope dates", () => {
  expect(
    buildCourseStagePlan(context, { ...output, stages: [stage] }),
  ).toMatchObject({ action: "CREATE", stages: [stage] });
  for (const invalid of [
    { ...stage, startDate: "2030-01-08" },
    { ...stage, endDate: "2030-01-12" },
    { ...stage, endDate: "2030-01-14" },
  ])
    expect(() =>
      buildCourseStagePlan(context, { ...output, stages: [invalid] }),
    ).toThrow();
});

test("reuses confirmed phases and ignores replacement phases supplied by the model", () => {
  expect(
    buildCourseStagePlan(
      {
        ...context,
        action: "REUSE",
        existing: { id: "existing", summary: "原安排", stages: [stage] },
      },
      { ...output, stages: [{ ...stage, title: "不应替换" }] },
    ),
  ).toMatchObject({ action: "REUSE", summary: "原安排", stages: [stage] });
});

test("extension preserves existing purposes and boundaries, fills gaps before and after", () => {
  const extended = buildCourseStagePlan(
    {
      ...context,
      action: "EXTEND",
      startDate: "2030-01-01",
      endDate: "2030-01-20",
      existing: { id: "existing", summary: "原安排", stages: [stage] },
    },
    {
      ...output,
      stages: [
        {
          ...stage,
          title: "新阶段",
          startDate: "2030-01-01",
          endDate: "2030-01-20",
        },
      ],
    },
  );
  expect(extended.stages).toEqual([
    {
      ...stage,
      title: "新阶段",
      startDate: "2030-01-01",
      endDate: "2030-01-06",
    },
    stage,
    {
      ...stage,
      title: "新阶段",
      startDate: "2030-01-14",
      endDate: "2030-01-20",
    },
  ]);
});

test("legacy model output retains the supplied explanation as a bounded phase", () => {
  const plan = buildCourseStagePlan(context, output);
  expect(plan.stages).toEqual([
    {
      ...stage,
      title: "课程训练阶段",
      purpose: output.stageSummary,
      assessmentSuggestion: output.assessmentSuggestion,
    },
  ]);
});

test("client course editing cannot inject stage replacements or discard the server-owned stage context", () => {
  expect(
    updateAiProposalSchema.safeParse({
      expectedProposalVersion: 1,
      draft: { ...output, stages: [stage] },
    }).success,
  ).toBe(false);
});
