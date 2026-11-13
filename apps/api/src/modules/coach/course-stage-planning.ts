import type { AiWeekOutput, CourseStagePlan } from "@ridepilot/contracts";
import { assertDateRange, validateStages } from "./stage-plan.validation";

type Stage = CourseStagePlan["stages"][number];
export type CourseStageContext = {
  basePlans: { id: string; version: number }[];
  action: CourseStagePlan["action"];
  startDate: string;
  endDate: string;
  existing?: { id: string; summary: string; stages: Stage[] };
};

export type CourseStageDraft = {
  context: CourseStageContext;
  plan: CourseStagePlan;
  generationId: string;
};

export const addStageDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

export function buildCourseStagePlan(
  context: CourseStageContext,
  output: AiWeekOutput,
): CourseStagePlan {
  const { action, startDate, endDate, existing } = context;
  assertDateRange(startDate, endDate, 365);
  if (action === "REUSE" && existing)
    return { action, startDate, endDate, ...existingPlan(existing) };

  // Older model adapters return only the already required phase explanation.
  // Preserve it as one phase per <=84-day block instead of losing the roadmap.
  const generated = output.stages ?? fallbackStages(context, output);
  validateStages(
    { summary: output.stageSummary, stages: generated },
    startDate,
    endDate,
  );
  const stages =
    action === "EXTEND" && existing
      ? [
          ...generated.flatMap((stage) => {
            const first = existing.stages[0].startDate;
            const last = existing.stages.at(-1)!.endDate;
            const parts: Stage[] = [];
            if (stage.startDate < first)
              parts.push({
                ...stage,
                endDate:
                  stage.endDate < first
                    ? stage.endDate
                    : addStageDays(first, -1),
              });
            if (stage.endDate > last)
              parts.push({
                ...stage,
                startDate:
                  stage.startDate > last
                    ? stage.startDate
                    : addStageDays(last, 1),
              });
            return parts;
          }),
          ...existing.stages,
        ].sort((a, b) => a.startDate.localeCompare(b.startDate))
      : generated;
  const summary =
    action === "EXTEND" && existing ? existing.summary : output.stageSummary;
  validateStages({ summary, stages }, startDate, endDate);
  return { action, startDate, endDate, summary, stages };
}

function existingPlan(existing: NonNullable<CourseStageContext["existing"]>) {
  return { summary: existing.summary, stages: existing.stages };
}

function fallbackStages(
  context: CourseStageContext,
  output: AiWeekOutput,
): Stage[] {
  const stages: Stage[] = [];
  for (let start = context.startDate; start <= context.endDate;) {
    const end = addStageDays(start, 83);
    const endDate = end < context.endDate ? end : context.endDate;
    stages.push({
      title: "课程训练阶段",
      purpose: output.stageSummary.slice(0, 300),
      assessmentSuggestion: output.assessmentSuggestion.slice(0, 300),
      startDate: start,
      endDate,
    });
    start = addStageDays(endDate, 1);
  }
  return stages;
}
