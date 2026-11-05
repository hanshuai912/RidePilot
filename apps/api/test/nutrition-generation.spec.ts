import { NutritionGenerationContextService } from "../src/modules/nutrition/nutrition-generation-context.service";
import { NutritionGenerationService } from "../src/modules/nutrition/nutrition-generation.service";
import { AiException } from "../src/ai/exceptions/ai.exception";

describe("NutritionGenerationService linked contexts", () => {
  function buildService(trainingProposal: object | null) {
    const prisma = {
      aiGeneration: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000010",
          status: "QUEUED",
          proposalId: null,
          errorCode: null,
          requestId: "request-1",
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
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
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      nutritionProfile: { findUnique: jest.fn() },
      nutritionPlan: { findFirst: jest.fn().mockResolvedValue(null) },
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
    prisma.nutritionProfile.findUnique.mockImplementation(
      repository.findProfile,
    );
    const ai = { generate: jest.fn() };
    const skill = { load: jest.fn() };
    const races = {
      reuseOrCreate: jest
        .fn()
        .mockImplementation(async (_userId, _input, _key, create) =>
          create(prisma),
        ),
    };
    return {
      races,
      service: new NutritionGenerationService(
        prisma as never,
        ai as never,
        skill as never,
        new NutritionGenerationContextService(prisma as never),
        races as never,
        races as never,
      ),
      prisma,
      ai,
      skill,
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

  function raceWorker() {
    const fixture = buildService(null);
    const { prisma, skill } = fixture;
    prisma.aiGeneration.findUnique.mockResolvedValue({
      id: "job",
      userId: "user",
      status: "RUNNING",
      scene: "NUTRITION_PLAN",
      attempts: 1,
      requestId: "request-1",
      input: {
        startDate: "2030-01-01",
        endDate: "2030-01-05",
        mode: "RACE_LINKED",
        expectedNutritionVersion: 0,
        raceId: "00000000-0000-4000-8000-000000000014",
      },
    } as never);
    prisma.trainingRace.findFirst.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000014",
      name: "测试赛事",
      localDate: new Date("2030-01-03T00:00:00Z"),
      distanceKm: 120,
      priority: "A",
    });
    skill.load.mockResolvedValue({
      content: "nutrition rules",
      version: "1",
      hash: "hash",
    });
    return {
      ...fixture,
      process: () =>
        (
          fixture.service as unknown as {
            process: (id: string) => Promise<void>;
          }
        ).process("job"),
    };
  }

  it("gives a five-day race draft enough output budget and persists only a validated proposal", async () => {
    const { ai, prisma, process } = raceWorker();
    const create = jest.fn().mockResolvedValue({ id: "proposal" });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ...prisma,
        aiGeneration: prisma.aiGeneration,
        nutritionPlan: { findFirst: jest.fn().mockResolvedValue(null) },
        nutritionProposal: {
          create,
          findMany: jest.fn().mockResolvedValue([]),
        },
      }),
    );
    ai.generate.mockResolvedValue({
      model: "test",
      text: JSON.stringify({
        summary: "五天备赛补给",
        assumptions: [],
        warnings: [],
        blockers: [],
        sourceRefs: [],
        confidence: "MEDIUM",
        draft: {
          startDate: "2030-01-01",
          endDate: "2030-01-05",
          dailyTarget: null,
          items: [
            {
              localDate: "2030-01-03",
              mealType: "BREAKFAST",
              scheduledLocalTime: "07:30",
              title: "赛前早餐",
              foods: [
                {
                  name: "燕麦",
                  amount: 80,
                  unit: "g",
                  allergenTags: [],
                  ingredientStatus: "KNOWN",
                },
              ],
              nutrients: {
                energyKcal: 500,
                carbohydrateG: 80,
                proteinG: 15,
                fatG: 10,
                fluidMl: 500,
                sodiumMg: null,
              },
              nutritionSource: "AI_ESTIMATE",
              confidence: "MEDIUM",
              linkedWorkoutId: null,
              notes: null,
            },
          ],
        },
      }),
    });
    await process();
    expect(ai.generate).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 20000 }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "READY",
          validationPassed: true,
        }),
      }),
    );
    expect(prisma.aiGeneration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "READY",
          proposalId: "proposal",
        }),
      }),
    );
  });

  it("fails promptly for a non-retryable invalid model response", async () => {
    const { ai, prisma, process } = raceWorker();
    ai.generate.mockRejectedValue(
      new AiException("AI_PROVIDER_INVALID_RESPONSE", "invalid", false),
    );
    await process();
    expect(prisma.aiGeneration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorCode: "AI_PROVIDER_INVALID_RESPONSE",
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("retains a retry for transient provider failures", async () => {
    const { ai, prisma, process } = raceWorker();
    ai.generate.mockRejectedValue(
      new AiException("AI_PROVIDER_TIMEOUT", "timeout", true),
    );
    await process();
    expect(prisma.aiGeneration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "QUEUED",
          errorCode: "AI_PROVIDER_TIMEOUT",
        }),
      }),
    );
  });
});
