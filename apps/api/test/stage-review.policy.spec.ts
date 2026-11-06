import { BadRequestException, ConflictException } from "@nestjs/common";
import type {
  StageReviewInput,
  StageReviewSnapshot,
  StageReviewEvidence,
} from "@ridepilot/contracts";
import { validateStageDecision } from "../src/modules/coach/goals/stage-review.policy";
import { assertStageReviewScope } from "../src/modules/coach/goals/stage-review.scope";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot: StageReviewSnapshot = {
  fingerprint: "a".repeat(64),
  localDate: "2026-11-06",
  goalId: id,
  goalVersion: 1,
  goalStatus: "ACTIVE",
  goalTargetDate: "2026-12-31",
  stageId: id,
  stagePlanId: id,
  stagePlanVersion: 2,
  stageTitle: "基础",
  startDate: "2026-11-01",
  endDate: "2026-11-14",
  criteria: "同路线记录实际结果",
  criteriaVersion: 1,
  stale: false,
  nextStage: {
    id: "00000000-0000-4000-8000-000000000002",
    title: "巩固",
    startDate: "2026-11-15",
    endDate: "2026-11-28",
  },
  training: {
    planned: 2,
    completed: 0,
    partial: 0,
    skipped: 0,
    unrecorded: 2,
    actualMinutes: null,
  },
  tests: [],
  notices: [],
};
const input: StageReviewInput = {
  expectedReviewId: null,
  fingerprint: snapshot.fingerprint,
  outcome: "MET",
  decision: "NEXT",
  rationale: "以路线实际证据确认",
};
const evidence: StageReviewEvidence = {
  id,
  stageId: id,
  ...input,
  snapshot,
  createdAt: "2026-11-06T00:00:00Z",
};
test("does not infer achievement from dates, training completion or absence of a prescribed test", () => {
  expect(() => validateStageDecision(snapshot, input)).not.toThrow();
  expect(() =>
    validateStageDecision(
      { ...snapshot, criteria: null },
      { ...input, outcome: "INSUFFICIENT", decision: "KEEP" },
    ),
  ).not.toThrow();
});
test.each([
  { criteria: null },
  { nextStage: null },
  { nextStage: { ...snapshot.nextStage!, endDate: "2026-11-05" } },
  { stale: true },
  { goalStatus: "PAUSED" },
  { startDate: "2026-11-10" },
])("rejects unsupported next-stage decisions: %j", (changes) => {
  expect(() =>
    validateStageDecision({ ...snapshot, ...changes }, input),
  ).toThrow(BadRequestException);
});
test("requires a fresh fingerprint and an achieved outcome for NEXT", () => {
  expect(() =>
    validateStageDecision(snapshot, { ...input, fingerprint: "b".repeat(64) }),
  ).toThrow(ConflictException);
  expect(() =>
    validateStageDecision(snapshot, { ...input, outcome: "INSUFFICIENT" }),
  ).toThrow(BadRequestException);
});
test("binds NEXT to the actual next stage and EXTEND to roadmap confirmation", () => {
  expect(() =>
    assertStageReviewScope(evidence, { goalId: id, stageId: id }),
  ).toThrow(BadRequestException);
  expect(() =>
    assertStageReviewScope(evidence, {
      goalId: id,
      stageId: snapshot.nextStage!.id,
    }),
  ).not.toThrow();
  expect(() =>
    assertStageReviewScope(
      {
        ...evidence,
        decision: "KEEP",
        snapshot: { ...snapshot, endDate: "2026-11-05" },
      },
      { goalId: id, stageId: id },
    ),
  ).toThrow(ConflictException);
  const extended = { ...evidence, decision: "EXTEND" as const };
  expect(() =>
    assertStageReviewScope(extended, { goalId: id, stageId: id }),
  ).toThrow(ConflictException);
  expect(() =>
    assertStageReviewScope(extended, { goalId: id }, true),
  ).not.toThrow();
});
test("allows ADJUST by dates only within the current goal and future range", () => {
  const adjusted = { ...evidence, decision: "ADJUST" as const };
  expect(() =>
    assertStageReviewScope(adjusted, {
      goalId: id,
      weekStartDate: "2026-11-06",
      endDate: "2026-12-01",
    }),
  ).not.toThrow();
  expect(() =>
    assertStageReviewScope(adjusted, {
      goalId: id,
      weekStartDate: "2026-11-05",
    }),
  ).toThrow(BadRequestException);
  expect(() =>
    assertStageReviewScope(adjusted, {
      goalId: id,
      weekStartDate: "2026-11-06",
      endDate: "2027-01-01",
    }),
  ).toThrow(BadRequestException);
});
