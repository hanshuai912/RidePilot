import { Prisma } from "../src/generated/prisma/client";
import { AiGenerationService } from "../src/modules/coach/ai-generation.service";
import type { AiService } from "../src/ai/ai.service";
import type { PrismaService } from "../src/infra/prisma/prisma.service";
import type { CoachDataService } from "../src/modules/coach/coach-data.service";
import type { CoachPlanValidator } from "../src/modules/coach/coach-plan.validator";
import type { SkillLoaderService } from "../src/modules/coach/skill-loader.service";

test("AI worker gives an actionable error when coach migrations are missing", async () => {
  const prisma = {
    aiGeneration: {
      findFirst: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("missing table", {
          code: "P2021",
          clientVersion: "7.10.0",
        }),
      ),
    },
  } as unknown as PrismaService;
  const worker = new AiGenerationService(
    prisma,
    {} as CoachDataService,
    {} as SkillLoaderService,
    {} as AiService,
    {} as CoachPlanValidator,
  );
  await expect(worker.onModuleInit()).rejects.toThrow(
    "pnpm --filter @ridepilot/api db:deploy",
  );
  worker.onModuleDestroy();
});

test("empty week keeps a past course and allows the remaining dates", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2030-01-09T03:00:00.000Z"));
  const workoutId = "00000000-0000-4000-8000-000000000010";
  const prisma = {
    trainingAvailability: {
      findUnique: jest.fn().mockResolvedValue({
        timezone: "UTC",
        weekdays: [
          { weekday: 1, availableMinutes: 60 },
          { weekday: 2, availableMinutes: 60 },
          { weekday: 3, availableMinutes: 60 },
          { weekday: 4, availableMinutes: 60 },
          { weekday: 5, availableMinutes: 60 },
          { weekday: 6, availableMinutes: 60 },
          { weekday: 0, availableMinutes: 60 },
        ],
        maxSessionMinutes: 60,
        version: 1,
      }),
    },
    athleteProfile: {
      findUnique: jest.fn().mockResolvedValue({
        experienceLevel: "BEGINNER",
        weightKg: 55,
      }),
    },
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ profileVersion: 1, timezone: "UTC" }),
    },
    trainingRace: { findMany: jest.fn().mockResolvedValue([]) },
    trainingAssessment: { findMany: jest.fn().mockResolvedValue([]) },
    trainingActivity: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const data = {
    readiness: jest.fn().mockResolvedValue({ ready: true, missingFields: [] }),
    latestFtp: jest.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000011",
      value: 193,
      measuredAt: new Date("2029-12-01T00:00:00.000Z"),
      source: "MANUAL",
    }),
    getGoal: jest.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000012",
      status: "ACTIVE",
      targetWkg: null,
      version: 1,
      type: "FTP",
      description: null,
      targetDate: new Date("2030-06-01T00:00:00.000Z"),
    }),
    activePlan: jest.fn().mockResolvedValue({
      activeVersion: {
        versionNo: 3,
        workouts: [
          {
            id: workoutId,
            scheduledDate: new Date("2030-01-08T00:00:00.000Z"),
            timeTargetMin: 40,
            title: "周二课程",
            purpose: "历史课程",
            structure: { segments: [] },
          },
        ],
      },
    }),
  } as unknown as CoachDataService;
  const worker = new AiGenerationService(
    prisma,
    data,
    {} as SkillLoaderService,
    {} as AiService,
    {} as CoachPlanValidator,
  );

  try {
    const context = await (
      worker as unknown as {
        context: (
          userId: string,
          input: unknown,
          scene: string,
        ) => Promise<{
          replaceWorkoutIds: string[];
          availableDates: string[];
        }>;
      }
    ).context(
      "00000000-0000-4000-8000-000000000013",
      {
        weekStartDate: "2030-01-07",
        goalId: "00000000-0000-4000-8000-000000000012",
        mode: "empty_week",
        expectedBaseVersion: 3,
      },
      "WEEK_PLAN",
    );
    expect(context.replaceWorkoutIds).toEqual([]);
    expect(context.availableDates).toEqual([
      "2030-01-09",
      "2030-01-10",
      "2030-01-11",
      "2030-01-12",
      "2030-01-13",
    ]);
  } finally {
    jest.useRealTimers();
  }
});
