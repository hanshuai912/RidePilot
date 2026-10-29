import { NutritionGenerationService } from "../src/modules/nutrition/nutrition-generation.service";

describe("NutritionGenerationService linked contexts", () => {
  function buildService(trainingProposal: object | null) {
    const prisma = {
      aiGeneration: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000010",
          status: "QUEUED",
          proposalId: null,
          errorCode: null,
          requestId: "request-1",
        }),
      },
      athleteProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          timezone: "Asia/Shanghai",
          locale: "zh-CN",
          profileVersion: 1,
        }),
      },
      trainingPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      workout: { findMany: jest.fn().mockResolvedValue([]) },
      trainingRace: { findFirst: jest.fn().mockResolvedValue(null) },
      changeProposal: {
        findFirst: jest.fn().mockResolvedValue(trainingProposal),
      },
    };
    const repository = {
      findProfile: jest.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000011",
        userId: "00000000-0000-4000-8000-000000000012",
        dietStyle: "OMNIVORE",
        habits: [],
        allergens: [],
        restrictions: [],
        restrictionNote: null,
        commonFoods: [],
        mealSchedule: [{ mealType: "BREAKFAST", localTime: "07:30" }],
        version: 1,
      }),
      findActivePlan: jest.fn().mockResolvedValue(null),
    };
    const ai = { generate: jest.fn() };
    const skill = { load: jest.fn() };
    return {
      service: new NutritionGenerationService(
        prisma as never,
        ai as never,
        skill as never,
        repository as never,
      ),
      prisma,
    };
  }

  it("accepts a ready AI training proposal as linked context", async () => {
    const { service, prisma } = buildService({
      id: "00000000-0000-4000-8000-000000000013",
      proposalType: "AI_WORKOUT_ADJUST",
      status: "READY",
      baseVersionId: null,
      baseVersion: null,
      original: null,
      draft: { workouts: [] },
    });

    const result = await service.submit(
      "00000000-0000-4000-8000-000000000012",
      {
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        mode: "TRAINING_LINKED",
        expectedNutritionVersion: 0,
        expectedTrainingPlanVersion: 0,
        trainingProposalId: "00000000-0000-4000-8000-000000000013",
      },
      "linked-training-1",
    );

    expect(result.status).toBe("QUEUED");
    expect(prisma.changeProposal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "00000000-0000-4000-8000-000000000013",
          userId: "00000000-0000-4000-8000-000000000012",
        },
      }),
    );
  });

  it("rejects a non-AI training proposal", async () => {
    const { service } = buildService({
      id: "00000000-0000-4000-8000-000000000013",
      proposalType: "MANUAL_WORKOUT_EDIT",
      status: "READY",
      baseVersionId: null,
      baseVersion: null,
      original: null,
      draft: { workouts: [] },
    });

    await expect(
      service.submit(
        "00000000-0000-4000-8000-000000000012",
        {
          startDate: "2030-01-01",
          endDate: "2030-01-01",
          mode: "TRAINING_LINKED",
          expectedNutritionVersion: 0,
          expectedTrainingPlanVersion: 0,
          trainingProposalId: "00000000-0000-4000-8000-000000000013",
        },
        "linked-training-2",
      ),
    ).rejects.toMatchObject({
      response: { code: "TRAINING_PROPOSAL_NOT_SUPPORTED" },
    });
  });

  it("accepts an owned race as linked context", async () => {
    const { service, prisma } = buildService(null);
    prisma.trainingRace.findFirst.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000014",
      name: "春季公路赛",
      localDate: new Date("2030-01-01T00:00:00.000Z"),
      distanceKm: 120,
      priority: "A",
    });

    const result = await service.submit(
      "00000000-0000-4000-8000-000000000012",
      {
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        mode: "RACE_LINKED",
        expectedNutritionVersion: 0,
        raceId: "00000000-0000-4000-8000-000000000014",
      },
      "linked-race-1",
    );

    expect(result.status).toBe("QUEUED");
  });
});
