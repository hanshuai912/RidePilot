import type { WeekGenerationInput } from "@ridepilot/contracts";
import { RaceTrainingService } from "../src/modules/coach/race-training.service";
import { racePlanningWindow } from "../src/modules/coach/race-planning.validation";
import type { PrismaService } from "../src/infra/prisma/prisma.service";
import type { AiGenerationService } from "../src/modules/coach/ai-generation.service";
import type { CoachProposalService } from "../src/modules/coach/coach-proposal.service";

const raceId = "00000000-0000-4000-8000-000000000003";
const proposalId = "00000000-0000-4000-8000-000000000005";
const input: WeekGenerationInput = {
  weekStartDate: "2030-01-09",
  endDate: "2030-01-20",
  mode: "range",
  goalId: "00000000-0000-4000-8000-000000000002",
  relatedId: raceId,
  reason: "RACE",
  relatedVersion: 1,
  racePhase: "PREPARATION",
  expectedBaseVersion: 2,
};
function fixture() {
  const race = {
    id: raceId,
    status: "CONFIRMED",
    localDate: new Date("2030-01-13Z"),
    version: 1,
    updatedAt: new Date("2030-01-01Z"),
  };
  const plan = { activeVersionId: "v2", activeVersion: { versionNo: 2 } };
  const row = {
    id: proposalId,
    draft: { relatedVersion: 1, endDate: "2030-01-20" },
    baseVersionId: "v2",
    appliedVersionId: null as string | null,
    status: "READY",
    expiresAt: null,
  };
  const job = {
    id: "00000000-0000-4000-8000-000000000004",
    scene: "RACE_REPLAN",
    input,
    status: "READY",
    proposalId,
    createdAt: new Date("2030-01-09Z"),
    errorCode: null,
    requestId: null,
  };
  const db = {
    trainingRace: { findFirst: jest.fn().mockImplementation(async () => race) },
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: "UTC" }),
    },
    trainingPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
    aiGeneration: {
      findMany: jest.fn().mockResolvedValue([job]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    changeProposal: { findMany: jest.fn().mockResolvedValue([row]) },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (callback) => callback(db));
  const proposals = {
    get: jest.fn().mockImplementation(async () => ({
      proposalId: row.id,
      status: row.status,
    })),
  };
  const generations = {
    submit: jest.fn().mockResolvedValue({ generationId: "new" }),
  };
  const service = new RaceTrainingService(
    db as unknown as PrismaService,
    generations as unknown as AiGenerationService,
    proposals as unknown as CoachProposalService,
  );
  return { service, db, race, plan, row, job, proposals, generations };
}
beforeEach(() =>
  jest.useFakeTimers().setSystemTime(new Date("2030-01-09T03:00:00Z")),
);
afterEach(() => jest.useRealTimers());

test("Sunday race preparation spans the following recovery week", () => {
  expect(
    racePlanningWindow(
      { status: "CONFIRMED", localDate: new Date("2030-01-13Z") },
      "2030-01-09",
    ),
  ).toMatchObject({
    phase: "PREPARATION",
    startDate: "2030-01-09",
    endDate: "2030-01-20",
  });
});
test("old completed and cancelled races plan from today rather than their historical week", () => {
  for (const status of ["COMPLETED", "CANCELLED"])
    expect(
      racePlanningWindow(
        { status, localDate: new Date("2029-12-01Z") },
        "2030-01-09",
      ),
    ).toMatchObject({
      phase: status === "COMPLETED" ? "RECOVERY" : "RETURN_TO_GOAL",
      startDate: "2030-01-09",
      endDate: "2030-01-22",
    });
});
test("race state recovers a draft without creating a generation", async () => {
  const { service, generations } = fixture();
  expect((await service.get("owner", raceId)).proposal?.status).toBe("READY");
  expect(generations.submit).not.toHaveBeenCalled();
});
test("applied plan survives reentry and normal generate requests", async () => {
  const { service, row, generations } = fixture();
  row.status = "APPLIED";
  row.appliedVersionId = "v2";
  expect((await service.get("owner", raceId)).proposal?.status).toBe("APPLIED");
  expect(
    (await service.submit("owner", raceId, input, "key")).generationId,
  ).toBeDefined();
  expect(generations.submit).not.toHaveBeenCalled();
});
test("explicit regeneration creates only a candidate under the user transaction", async () => {
  const { service, db, row, generations } = fixture();
  row.status = "APPLIED";
  row.appliedVersionId = "v2";
  await service.submit(
    "owner",
    raceId,
    { ...input, forceRegenerate: true },
    "key",
  );
  expect(generations.submit).toHaveBeenCalledWith(
    "owner",
    expect.objectContaining({ forceRegenerate: true }),
    "key",
    "RACE_REPLAN",
    db,
  );
});
test("pending job is resumed even when regenerate is clicked", async () => {
  const { service, job, db, generations } = fixture();
  job.status = "RUNNING";
  db.changeProposal.findMany.mockResolvedValue([]);
  expect(
    (
      await service.submit(
        "owner",
        raceId,
        { ...input, forceRegenerate: true },
        "key",
      )
    ).status,
  ).toBe("RUNNING");
  expect(generations.submit).not.toHaveBeenCalled();
});
test.each(["race", "plan", "expired"])(
  "stale %s draft is not restored",
  async (kind) => {
    const { service, race, plan, row } = fixture();
    if (kind === "race") race.version = 2;
    if (kind === "plan") plan.activeVersionId = "v3";
    if (kind === "expired") row.draft.endDate = "2030-01-08";
    const state = await service.get("owner", raceId);
    expect(state.proposal).toBeNull();
    expect(state.message).toContain("失效");
  },
);
test("phase mismatch and foreign race fail without submitting", async () => {
  const { service, db, generations } = fixture();
  await expect(
    service.get("owner", raceId, "RETURN_TO_GOAL"),
  ).rejects.toMatchObject({ response: { code: "RACE_PHASE_CONFLICT" } });
  db.trainingRace.findFirst.mockResolvedValue(null);
  await expect(service.get("other", raceId)).rejects.toMatchObject({
    response: { code: "RACE_NOT_FOUND" },
  });
  expect(generations.submit).not.toHaveBeenCalled();
});
test("invalid and historical ranges are rejected", async () => {
  const { service } = fixture();
  await expect(
    service.submit(
      "owner",
      raceId,
      { ...input, weekStartDate: "2030-01-08" },
      "key",
    ),
  ).rejects.toMatchObject({ response: { code: "INVALID_DATE_RANGE" } });
  await expect(
    service.submit("owner", raceId, { ...input, endDate: "2031-01-20" }, "key"),
  ).rejects.toBeDefined();
});

test("reentry restores the selected custom scope rather than replacing it with the default", async () => {
  const { service, job } = fixture();
  job.input = { ...input, weekStartDate: "2030-01-10", endDate: "2030-01-25" };
  const state = await service.get("owner", raceId);
  expect(state).toMatchObject({
    startDate: "2030-01-10",
    endDate: "2030-01-25",
  });
});
