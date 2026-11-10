import type { CoachSuggestion, WorkoutSegment } from "@ridepilot/contracts";
import { keyWorkoutIntensity, selectHomeSuggestion } from "../model/coach-home";

const suggestion: CoachSuggestion = {
  id: "draft",
  kind: "TRAINING",
  title: "草稿",
  summary: "真实草稿",
  status: "READY",
  version: 1,
  createdAt: "2030-01-09T00:00:00Z",
  goalId: null,
  staleReason: null,
};

it("prioritizes actionable blockers over new drafts and running jobs without changing the input", () => {
  const items: CoachSuggestion[] = [
    {
      ...suggestion,
      id: "job",
      kind: "GENERATION",
      status: "RUNNING",
      createdAt: "2030-01-10T00:00:00Z",
    },
    { ...suggestion, id: "draft" },
    {
      ...suggestion,
      id: "blocker",
      status: "BLOCKED",
      createdAt: "2030-01-08T00:00:00Z",
    },
  ];
  expect(selectHomeSuggestion(items)?.id).toBe("blocker");
  expect(items.map((item) => item.id)).toEqual(["job", "draft", "blocker"]);
  expect(selectHomeSuggestion(items.slice(0, 2))?.id).toBe("draft");
  expect(selectHomeSuggestion([])).toBeNull();
  expect(
    selectHomeSuggestion([
      { ...suggestion, id: "old", createdAt: "2030-01-08T00:00:00Z" },
      suggestion,
    ])?.id,
  ).toBe("draft");
});

it("summarizes only work intensity and keeps watts separate from FTP percentages", () => {
  const work: WorkoutSegment = {
    type: "work",
    target: { kind: "duration", value: 20, unit: "min" },
    intensity: { kind: "ftp_percent", min: 60, max: 70 },
  };
  expect(
    keyWorkoutIntensity([
      {
        ...work,
        type: "warmup",
        intensity: { kind: "ftp_percent", min: 30, max: 50 },
      },
      work,
    ]),
  ).toBe("60–70 %FTP");
  expect(
    keyWorkoutIntensity([
      work,
      { ...work, intensity: { kind: "power_watt", min: 120, max: 150 } },
    ]),
  ).toBe("多目标强度 · 见课程");
  expect(
    keyWorkoutIntensity([
      { ...work, intensity: { kind: "power_watt", min: 180, max: 180 } },
    ]),
  ).toBe("180 W");
  expect(keyWorkoutIntensity([])).toBeNull();
});
