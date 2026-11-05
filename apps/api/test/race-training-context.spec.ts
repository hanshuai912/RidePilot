import type { WeekGenerationInput } from "@ridepilot/contracts";
import { CoachGenerationContextService } from "../src/modules/coach/coach-generation-context.service";
import type { CoachDataService } from "../src/modules/coach/coach-data.service";
import type { PrismaService } from "../src/infra/prisma/prisma.service";
import type { TrainingRangeService } from "../src/modules/coach/training-range.service";
import type { AssessmentReviewService } from "../src/modules/coach/assessment-review.service";
import { AiGenerationService } from "../src/modules/coach/ai-generation.service";
import { CoachPlanValidator } from "../src/modules/coach/coach-plan.validator";
import type { AiService } from "../src/ai/ai.service";
import type { SkillLoaderService } from "../src/modules/coach/skill-loader.service";
import type { StagePlansService } from "../src/modules/coach/stage-plans.service";

const input: WeekGenerationInput = {
  weekStartDate: "2030-01-07",
  goalId: "00000000-0000-4000-8000-000000000002",
  mode: "replace_week",
  relatedId: "00000000-0000-4000-8000-000000000003",
  expectedBaseVersion: 0,
};
const workout = (id: string, day: string) => ({
  id,
  scheduledDate: new Date(`${day}T00:00:00Z`),
  title: id,
  purpose: "耐力",
  timeTargetMin: 30,
  structure: { segments: [] },
});

function fixture() {
  const race = {
    id: input.relatedId,
    version: 1,
    localDate: new Date("2030-01-13T00:00:00Z"),
    name: "比赛",
    distanceKm: 100,
    status: "CONFIRMED",
    priority: "A",
    result: null,
  };
  const db = {
    trainingAvailability: {
      findUnique: jest.fn().mockResolvedValue({
        weekdays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          availableMinutes: 60,
        })),
        maxSessionMinutes: 60,
        version: 1,
      }),
    },
    athleteProfile: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ experienceLevel: "BEGINNER", weightKg: 60 }),
    },
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ profileVersion: 1, timezone: "UTC" }),
    },
    trainingRace: {
      findMany: jest.fn().mockResolvedValue([race]),
      findFirst: jest.fn().mockResolvedValue(race),
    },
    trainingAssessment: { findMany: jest.fn().mockResolvedValue([]) },
    trainingActivity: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const data = {
    readiness: jest.fn().mockResolvedValue({ ready: true, missingFields: [] }),
    latestFtp: jest.fn().mockResolvedValue({
      id: "ftp",
      value: 200,
      measuredAt: new Date("2030-01-01T00:00:00Z"),
      source: "MANUAL",
    }),
    getGoal: jest.fn().mockResolvedValue({
      id: input.goalId,
      version: 1,
      status: "ACTIVE",
      type: "RACE",
      targetDate: new Date("2030-01-13T00:00:00Z"),
      targetWkg: null,
    }),
    activePlan: jest.fn().mockResolvedValue(null),
  };
  const service = new CoachGenerationContextService(
    db as unknown as PrismaService,
    data as unknown as CoachDataService,
    {} as TrainingRangeService,
    {} as AssessmentReviewService,
  );
  return { db, data, service };
}
beforeEach(() =>
  jest.useFakeTimers().setSystemTime(new Date("2030-01-09T03:00:00Z")),
);
afterEach(() => jest.useRealTimers());

test("race can create the first plan draft with no replacement courses", async () => {
  const { service } = fixture();
  const context = await service.load("owner", input, "RACE_REPLAN");
  expect(context.plan).toBeNull();
  expect(context.replaceWorkoutIds).toEqual([]);
  expect(context.availableDates).toEqual([
    "2030-01-09",
    "2030-01-10",
    "2030-01-11",
    "2030-01-12",
  ]);
});

test("existing plan with an empty race week can add courses", async () => {
  const { service, data } = fixture();
  data.activePlan.mockResolvedValue({
    activeVersion: {
      versionNo: 3,
      workouts: [workout("outside", "2030-01-15")],
    },
  });
  const context = await service.load(
    "owner",
    { ...input, expectedBaseVersion: 3 },
    "RACE_REPLAN",
  );
  expect(context.existingWorkouts).toEqual([]);
  expect(context.replaceWorkoutIds).toEqual([]);
});

test("only editable workouts are replaced; historical and recorded courses are retained", async () => {
  const { service, data, db } = fixture();
  data.activePlan.mockResolvedValue({
    activeVersion: {
      versionNo: 3,
      workouts: [
        workout("past", "2030-01-08"),
        workout("recorded", "2030-01-09"),
        workout("editable", "2030-01-10"),
      ],
    },
  });
  db.trainingActivity.findMany.mockResolvedValue([{ workoutId: "recorded" }]);
  const context = await service.load(
    "owner",
    { ...input, expectedBaseVersion: 3 },
    "RACE_REPLAN",
  );
  expect(context.replaceWorkoutIds).toEqual(["editable"]);
  expect(context.retainedMinutes).toEqual({
    "2030-01-08": 30,
    "2030-01-09": 30,
  });
});

test("a week containing only recorded courses is valid for race generation", async () => {
  const { service, data, db } = fixture();
  data.activePlan.mockResolvedValue({
    activeVersion: {
      versionNo: 3,
      workouts: [workout("recorded", "2030-01-09")],
    },
  });
  db.trainingActivity.findMany.mockResolvedValue([{ workoutId: "recorded" }]);
  expect(
    (
      await service.load(
        "owner",
        { ...input, expectedBaseVersion: 3 },
        "RACE_REPLAN",
      )
    ).replaceWorkoutIds,
  ).toEqual([]);
});

test.each(["ftp", "availability", "goal", "experienceLevel", "weightKg"])(
  "missing %s is returned as an actionable field",
  async (field) => {
    const { service, data } = fixture();
    data.readiness.mockResolvedValue({ ready: false, missingFields: [field] });
    await expect(
      service.load("owner", input, "RACE_REPLAN"),
    ).rejects.toMatchObject({ response: { missingFields: [field] } });
  },
);

test("no available dates produces a clear failure", async () => {
  const { service, db } = fixture();
  db.trainingAvailability.findUnique.mockResolvedValue({
    weekdays: [{ weekday: 0, availableMinutes: 60 }],
    maxSessionMinutes: 60,
    version: 1,
  });
  await expect(
    service.load("owner", input, "RACE_REPLAN"),
  ).rejects.toMatchObject({
    response: { code: "NO_REMAINING_TRAINING_DATES" },
  });
});

test("plan version conflicts are still rejected", async () => {
  const { service, data } = fixture();
  data.activePlan.mockResolvedValue({
    activeVersion: { versionNo: 2, workouts: [] },
  });
  await expect(
    service.load("owner", input, "RACE_REPLAN"),
  ).rejects.toMatchObject({ response: { code: "PLAN_VERSION_CONFLICT" } });
});

test("race ownership is checked before generation", async () => {
  const { service, db } = fixture();
  db.trainingRace.findFirst.mockResolvedValue(null);
  await expect(
    service.load("owner", input, "RACE_REPLAN"),
  ).rejects.toMatchObject({ response: { code: "RACE_NOT_FOUND" } });
  expect(db.trainingRace.findFirst).toHaveBeenCalledWith({
    where: { id: input.relatedId, userId: "owner" },
    include: { result: true },
  });
});

test("ordinary adjustments still require existing courses", async () => {
  const { service, data } = fixture();
  data.activePlan.mockResolvedValue({
    activeVersion: { versionNo: 2, workouts: [] },
  });
  await expect(
    service.load("owner", { ...input, expectedBaseVersion: 2 }, "PLAN_ADJUST"),
  ).rejects.toMatchObject({ response: { code: "NO_EDITABLE_WORKOUTS" } });
});

test.each([false, true])(
  "unsafe race output receives bounded recovery feedback (second attempt invalid: %s)",
  async (failAgain) => {
    const { db, service } = fixture();
    const job = {
      id: "job",
      userId: "owner",
      status: "RUNNING",
      scene: "RACE_REPLAN",
      input,
      attempts: 1,
      errorCode: null as string | null,
    };
    const course = (date: string, max: number) => ({
      scheduledDate: date,
      title: "备赛骑行",
      purpose: "减量",
      segments: [
        {
          type: "work",
          target: { kind: "duration", value: 20, unit: "min" },
          intensity: { kind: "ftp_percent", min: 60, max },
        },
      ],
    });
    const output = (unsafe: boolean) => ({
      summary: "备赛计划",
      stageSummary: "减量",
      assessmentSuggestion: "赛后复评",
      workouts: [
        course("2030-01-09", 90),
        course("2030-01-10", unsafe ? 90 : 70),
      ],
    });
    const model = {
      generate: jest
        .fn()
        .mockResolvedValueOnce({
          text: JSON.stringify(output(true)),
          model: "test",
        })
        .mockResolvedValue({
          text: JSON.stringify(output(failAgain)),
          model: "test",
        }),
    };
    const prisma = {
      ...db,
      aiGeneration: {
        findUnique: jest.fn().mockImplementation(async () => job),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      changeProposal: { create: jest.fn().mockResolvedValue({ id: "draft" }) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    const worker = new AiGenerationService(
      prisma as unknown as PrismaService,
      service,
      {
        load: jest.fn().mockResolvedValue({
          content: "Race preparation",
          version: "1",
          hash: "hash",
        }),
      } as unknown as SkillLoaderService,
      model as unknown as AiService,
      new CoachPlanValidator(),
      {} as StagePlansService,
    );
    await worker.process("job");
    expect(prisma.changeProposal.create).not.toHaveBeenCalled();
    expect(prisma.aiGeneration.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "QUEUED",
          errorCode: "INSUFFICIENT_RECOVERY",
        }),
      }),
    );
    job.attempts = 2;
    job.errorCode = "INSUFFICIENT_RECOVERY";
    await worker.process("job");
    expect(model.generate).toHaveBeenCalledTimes(2);
    expect(model.generate.mock.calls[1][0].messages[2].content).toContain(
      "previousValidationError",
    );
    if (failAgain) {
      expect(prisma.changeProposal.create).not.toHaveBeenCalled();
      expect(prisma.aiGeneration.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "FAILED",
            errorCode: "INSUFFICIENT_RECOVERY",
          }),
        }),
      );
      return;
    }
    expect(prisma.changeProposal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        proposalType: "AI_RACE_REPLAN",
        baseVersionId: null,
        validationPassed: true,
        draft: expect.objectContaining({
          replaceWorkoutIds: [],
          relatedId: "00000000-0000-4000-8000-000000000003",
          relatedVersion: 1,
        }),
      }),
    });
    expect(prisma.aiGeneration.update).toHaveBeenCalledWith({
      where: { id: "job" },
      data: expect.objectContaining({ status: "READY", proposalId: "draft" }),
    });
  },
);
