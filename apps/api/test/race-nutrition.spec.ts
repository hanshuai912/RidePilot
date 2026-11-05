import { RaceNutritionService } from "../src/modules/nutrition/race-nutrition.service";

const raceId = "00000000-0000-4000-8000-000000000001";
const jobId = "00000000-0000-4000-8000-000000000002";
const proposalId = "00000000-0000-4000-8000-000000000003";
const newerId = "00000000-0000-4000-8000-000000000004";
const input = {
  mode: "RACE_LINKED" as const,
  raceId,
  startDate: "2030-06-07",
  endDate: "2030-06-11",
  expectedNutritionVersion: 1,
};
const job = {
  id: jobId,
  status: "READY",
  proposalId,
  errorCode: null,
  requestId: null,
  input,
};
const proposal = {
  id: proposalId,
  status: "APPLIED",
  appliedVersionId: "version-1",
  baseVersionId: null,
  baseVersion: null,
  proposalVersion: 1,
  proposalType: "AI_PLAN",
  draft: {},
  original: null,
  validationPassed: true,
  validationWarnings: [],
  validationBlockers: [],
  metadata: null,
  expiresAt: null,
};

function fixture() {
  const db = {
    trainingRace: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: raceId, updatedAt: new Date("2030-01-01") }),
    },
    aiGeneration: {
      findMany: jest.fn().mockResolvedValue([job]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    nutritionProposal: { findMany: jest.fn().mockResolvedValue([proposal]) },
    nutritionPlan: {
      findFirst: jest.fn().mockResolvedValue({
        activeVersionId: "version-1",
        activeVersion: { versionNo: 1 },
      }),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (callback) => callback(db));
  return { db, service: new RaceNutritionService(db as never) };
}

test("prefers the current applied race plan over an accidental newer draft", async () => {
  const { db, service } = fixture();
  db.aiGeneration.findMany.mockResolvedValue([
    { ...job, id: newerId, proposalId: newerId },
    job,
  ]);
  db.nutritionProposal.findMany.mockResolvedValue([
    {
      ...proposal,
      id: newerId,
      status: "READY",
      appliedVersionId: null,
      baseVersionId: "version-1",
    },
    proposal,
  ] as never);
  const state = await service.get("owner", raceId);
  expect(state.proposal?.status).toBe("APPLIED");
  expect(state.generation?.generationId).toBe(jobId);
  expect(db.aiGeneration.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        userId: "owner",
        input: { path: ["raceId"], equals: raceId },
      }),
    }),
  );
  expect(db.nutritionProposal.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ userId: "owner" }),
    }),
  );
});

test("rejects races not owned by the caller before querying nutrition data", async () => {
  const { db, service } = fixture();
  db.trainingRace.findFirst.mockResolvedValue(null);
  await expect(service.get("stranger", raceId)).rejects.toMatchObject({
    response: { code: "RACE_NOT_FOUND" },
  });
  expect(db.trainingRace.findFirst).toHaveBeenCalledWith({
    where: { id: raceId, userId: "stranger" },
  });
  expect(db.aiGeneration.findMany).not.toHaveBeenCalled();
});

test("restores an existing running task instead of requiring another submission", async () => {
  const { db, service } = fixture();
  db.aiGeneration.findMany.mockResolvedValue([
    { ...job, status: "RUNNING", proposalId: null },
  ]);
  db.nutritionProposal.findMany.mockResolvedValue([]);
  const state = await service.get("owner", raceId);
  expect(state.generation?.status).toBe("RUNNING");
  expect(state.proposal).toBeNull();
});

test("does not restore a draft based on a superseded nutrition version", async () => {
  const { db, service } = fixture();
  db.nutritionProposal.findMany.mockResolvedValue([
    {
      ...proposal,
      status: "READY",
      appliedVersionId: null,
      baseVersionId: "old-version",
    },
  ] as never);
  expect(await service.get("owner", raceId)).toEqual({
    generation: null,
    proposal: null,
  });
});

test("does not restore an expired draft", async () => {
  const { db, service } = fixture();
  db.nutritionProposal.findMany.mockResolvedValue([
    {
      ...proposal,
      status: "READY",
      appliedVersionId: null,
      baseVersionId: "version-1",
      expiresAt: new Date("2000-01-01"),
    },
  ] as never);
  expect(await service.get("owner", raceId)).toEqual({
    generation: null,
    proposal: null,
  });
});

test("only considers tasks created after the most recent race change", async () => {
  const { db, service } = fixture();
  await service.get("owner", raceId);
  expect(db.aiGeneration.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        createdAt: { gte: new Date("2030-01-01") },
      }),
    }),
  );
});

test("repeat submissions with different keys reuse the existing task inside a user lock", async () => {
  const { db, service } = fixture();
  const create = jest.fn();
  const first = await service.reuseOrCreate("owner", input, "key-1", create);
  const second = await service.reuseOrCreate("owner", input, "key-2", create);
  expect(first.generationId).toBe(jobId);
  expect(second.generationId).toBe(jobId);
  expect(create).not.toHaveBeenCalled();
  expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  expect(db.$transaction).toHaveBeenCalledTimes(2);
});

test("creates a new task only when there is no reusable result", async () => {
  const { db, service } = fixture();
  db.aiGeneration.findMany.mockResolvedValue([]);
  db.nutritionProposal.findMany.mockResolvedValue([]);
  const create = jest
    .fn()
    .mockResolvedValue({ generationId: jobId, status: "QUEUED" });
  expect(await service.reuseOrCreate("owner", input, "new", create)).toEqual({
    generationId: jobId,
    status: "QUEUED",
  });
  expect(create).toHaveBeenCalledWith(db);
});

test("an idempotency key used for different input still returns a conflict", async () => {
  const { db, service } = fixture();
  db.aiGeneration.findUnique.mockResolvedValue({
    ...job,
    scene: "NUTRITION_PLAN",
    input: { ...input, notes: "different" },
  });
  await expect(
    service.reuseOrCreate("owner", input, "used", jest.fn()),
  ).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_KEY_CONFLICT" } });
});

test("explicit regeneration creates a new candidate even when a plan was already applied", async () => {
  const { service } = fixture();
  const create = jest
    .fn()
    .mockResolvedValue({ generationId: newerId, status: "QUEUED" });
  expect(
    await service.reuseOrCreate(
      "owner",
      { ...input, forceRegenerate: true },
      "new",
      create,
    ),
  ).toEqual({ generationId: newerId, status: "QUEUED" });
  expect(create).toHaveBeenCalledTimes(1);
});

test("an explicitly requested replacement draft is restored before the old applied version", async () => {
  const { db, service } = fixture();
  db.aiGeneration.findMany.mockResolvedValue([
    {
      ...job,
      id: newerId,
      proposalId: newerId,
      input: { ...input, forceRegenerate: true },
    },
    job,
  ]);
  db.nutritionProposal.findMany.mockResolvedValue([
    {
      ...proposal,
      id: newerId,
      status: "READY",
      appliedVersionId: null,
      baseVersionId: "version-1",
    },
    proposal,
  ] as never);
  const state = await service.get("owner", raceId);
  expect(state.proposal?.status).toBe("READY");
  expect(state.generation?.generationId).toBe(newerId);
});

test("repeat regeneration requests reuse an explicit replacement task still in progress", async () => {
  const { db, service } = fixture();
  db.aiGeneration.findMany.mockResolvedValue([
    {
      ...job,
      id: newerId,
      status: "QUEUED",
      proposalId: null,
      input: { ...input, forceRegenerate: true },
    },
    job,
  ]);
  const create = jest.fn();
  const state = await service.reuseOrCreate(
    "owner",
    { ...input, forceRegenerate: true },
    "again",
    create,
  );
  expect(state.generationId).toBe(newerId);
  expect(create).not.toHaveBeenCalled();
});
