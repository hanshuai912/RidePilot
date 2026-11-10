import type {
  CoachOverview,
  CoachSuggestion,
  WorkoutSegment,
} from "@ridepilot/contracts";

export const coachStatusSummary: Record<
  CoachOverview["status"]["code"],
  string
> = {
  INSUFFICIENT: "恢复状态待评估",
  STABLE: "近期疲劳反馈平稳",
  RECOVERING: "建议关注恢复",
  REASSESS: "建议复评",
};

// The API has no priority field. Surface actionable blockers, then resumable
// drafts, then running jobs. Preserve the source order when dates are equal.
export function selectHomeSuggestion(items: CoachSuggestion[]) {
  const rank = (item: CoachSuggestion) =>
    item.kind === "GENERATION" ? 2 : item.status === "BLOCKED" ? 0 : 1;
  return (
    [...items].sort(
      (a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt),
    )[0] ?? null
  );
}

export function keyWorkoutIntensity(segments: WorkoutSegment[]) {
  const work = segments.filter((segment) => segment.type === "work");
  if (!work.length) return null;
  const kind = work[0].intensity.kind;
  if (work.some((segment) => segment.intensity.kind !== kind))
    return "多目标强度 · 见课程";
  const min = Math.min(...work.map((segment) => segment.intensity.min));
  const max = Math.max(...work.map((segment) => segment.intensity.max));
  return `${min === max ? min : `${min}–${max}`} ${kind === "power_watt" ? "W" : "%FTP"}`;
}
