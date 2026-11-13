import {
  goalInputSchema,
  goalSchema,
  raceInputSchema,
} from "@ridepilot/contracts";
import {
  planningGoalsMatch,
  planningInstructions,
} from "../src/modules/coach/goals/planning-goals";

const goal = {
  id: "00000000-0000-4000-8000-000000000001",
  type: "ENDURANCE" as const,
  priority: "PRIMARY" as const,
  status: "ACTIVE" as const,
  version: 1,
};

test("goals need no achievement date while real races still require a date", () => {
  expect(
    goalInputSchema.safeParse({ type: goal.type, priority: goal.priority })
      .success,
  ).toBe(true);
  expect(goalSchema.parse({ ...goal, targetDate: "2020-01-01" })).toEqual(goal);
  expect(
    raceInputSchema.safeParse({
      name: "公路赛",
      timezone: "UTC",
      distanceKm: 100,
      priority: "A",
    }).success,
  ).toBe(false);
  expect(
    raceInputSchema.safeParse({
      name: "公路赛",
      timezone: "UTC",
      distanceKm: 100,
      priority: "A",
      localDate: "2030-01-01",
    }).success,
  ).toBe(true);
});

test("old roadmap snapshots ignore obsolete deadlines but still detect changed goal versions", () => {
  const legacy = {
    goals: [{ ...goal, targetDate: "2020-01-01" }],
    tradeoffs: [],
  };
  expect(planningGoalsMatch(legacy, [goal])).toBe(true);
  expect(planningGoalsMatch(legacy, [{ ...goal, version: 2 }])).toBe(false);
  expect(planningGoalsMatch(null, [goal])).toBe(false);
  expect(planningInstructions).toContain("目标没有达成截止日期");
  expect(planningInstructions).toContain("疲劳反馈与阶段复评");
});
