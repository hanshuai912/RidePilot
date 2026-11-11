import { randomUUID } from "node:crypto";
import { buildCycleReview } from "../src/modules/coach/cycle-review/cycle-review.policy";
import type { CycleReviewData } from "../src/modules/coach/cycle-review/cycle-review.repository";
import { readCycleReviewData } from "../src/modules/coach/cycle-review/cycle-review.repository";
import type { Prisma } from "../src/generated/prisma/client";
import { generationTaskKey } from "../src/infra/prisma/generation-candidates";

// Minimal persisted rows; unrelated Prisma columns are deliberately omitted.
const fixture = () =>
  ({
    user: { timezone: "UTC", profileVersion: 1 },
    today: "2030-01-07",
    startDate: "2030-01-01",
    endDate: "2030-01-07",
    plan: null,
    records: [],
    recent: [],
    goals: [],
    goal: null,
    availability: null,
    profile: null,
    ftp: [],
    tests: [],
    roadmap: null,
    active: [],
    originals: [],
  }) as unknown as CycleReviewData;
const feedback = (status = "COMPLETED", fatigue: number | null = null) =>
  ({
    id: randomUUID(),
    workoutId: null,
    localDate: new Date("2030-01-07"),
    status,
    durationMin: null,
    rpe: 10,
    fatigue,
    notes: null,
  }) as CycleReviewData["records"][number];

it("keeps absent data unknown, and never infers recovery or FTP gains from high RPE", () => {
  const data = fixture();
  const empty = buildCycleReview(data);
  expect(empty.stats).toMatchObject({
    planned: 0,
    completionRate: null,
    actualMinutes: null,
    plannedMinutes: null,
    rpeAverage: null,
  });
  expect(empty.missingFields).toEqual(
    expect.arrayContaining(["goal", "ftp", "availability", "experienceLevel"]),
  );
  const r = feedback();
  data.records = [r];
  data.recent = [r];
  expect(buildCycleReview(data).recommendation.code).toBe("INSUFFICIENT");
  expect(buildCycleReview(data).stats.rpeAverage).toBe(10);
});

it("uses the latest filled fatigue, not the worst older reading", () => {
  const data = fixture(),
    latest = feedback("COMPLETED", 3),
    older = feedback("COMPLETED", 9);
  data.records = [older, latest];
  data.recent = [latest, older];
  expect(buildCycleReview(data).recommendation.code).toBe("CONTINUE");
  latest.fatigue = 8;
  expect(buildCycleReview(data).recommendation.code).toBe("RECOVERY");
});

it("counts only recorded partial/skipped outcomes toward the adjustment rule", () => {
  const data = fixture();
  data.records = [feedback("PARTIAL"), feedback("SKIPPED")];
  expect(buildCycleReview(data).recommendation.code).toBe("ADJUST");
  data.records = [feedback("SKIPPED")];
  expect(buildCycleReview(data).recommendation.code).toBe("INSUFFICIENT");
});

it("asks for reassessment on a newly completed test without changing FTP or stages", () => {
  const data = fixture();
  data.tests = [
    {
      id: randomUUID(),
      localDate: new Date("2030-01-04"),
      actualDate: null,
      protocol: "FTP20",
      status: "COMPLETED",
      resultWatts: null,
      updatedAt: new Date("2030-01-05"),
    },
  ] as CycleReviewData["tests"];
  const snapshot = buildCycleReview(data);
  expect(snapshot.recommendation.code).toBe("INSUFFICIENT");
  expect(snapshot.ftp).toBeNull();
  expect(snapshot.stage).toBeNull();
});

it("changes the fingerprint for a corrected note even when totals are unchanged", () => {
  const data = fixture();
  data.records = [feedback()];
  const before = buildCycleReview(data);
  data.records[0].notes = "更正反馈";
  const after = buildCycleReview(data);
  expect(after.stats).toEqual(before.stats);
  expect(after.fingerprint).not.toBe(before.fingerprint);
});

it("separates review task scopes while allowing newer evidence to replace the same choice", () => {
  const input = {
    mode: "range",
    goalId: randomUUID(),
    weekStartDate: "2030-01-08",
    endDate: "2030-01-14",
    cycleReview: {
      startDate: "2030-01-01",
      endDate: "2030-01-07",
      action: "CONTINUE",
      fingerprint: "a".repeat(64),
    },
  };
  expect(generationTaskKey(input)).toBe(
    generationTaskKey({
      ...input,
      cycleReview: { ...input.cycleReview, fingerprint: "b".repeat(64) },
    }),
  );
  expect(generationTaskKey(input)).not.toBe(
    generationTaskKey({
      ...input,
      cycleReview: { ...input.cycleReview, action: "RECOVERY" },
    }),
  );
  expect(generationTaskKey(input)).not.toBe(
    generationTaskKey({ ...input, cycleReview: undefined }),
  );
});

it("uses the account timezone at midnight instead of the host date", async () => {
  const db = {
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ timezone: "Asia/Shanghai" }),
    },
    trainingPlan: { findFirst: jest.fn().mockResolvedValue(null) },
    trainingActivity: { findMany: jest.fn().mockResolvedValue([]) },
    trainingGoal: { findMany: jest.fn().mockResolvedValue([]) },
    trainingAvailability: { findUnique: jest.fn().mockResolvedValue(null) },
    athleteProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    abilityMeasurement: { findMany: jest.fn().mockResolvedValue([]) },
    trainingAssessment: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const data = await readCycleReviewData(
    db as unknown as Prisma.TransactionClient,
    "user",
    undefined,
    new Date("2030-01-07T17:00:00Z"),
  );
  expect(data).toMatchObject({
    today: "2030-01-08",
    startDate: "2030-01-02",
    endDate: "2030-01-08",
  });
  expect(
    db.trainingActivity.findMany.mock.calls[0][0].where.localDate.lte,
  ).toEqual(new Date("2030-01-08T00:00:00Z"));
});
