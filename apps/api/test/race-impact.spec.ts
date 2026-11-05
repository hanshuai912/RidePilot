import { RaceImpactService } from "../src/modules/coach/race-impact.service";
import type { PrismaService } from "../src/infra/prisma/prisma.service";

function fixture() {
  const race = {
    id: "race",
    userId: "owner",
    localDate: new Date("2030-01-13Z"),
    status: "CONFIRMED",
    priority: "A",
    distanceKm: 100,
  };
  const db = {
    trainingRace: {
      findFirst: jest.fn().mockResolvedValue(race),
      findMany: jest.fn().mockResolvedValue([
        {
          id: "other",
          name: "下周重要赛",
          localDate: new Date("2030-01-19Z"),
          priority: "B",
        },
      ]),
    },
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: "UTC" }),
    },
    trainingPlan: {
      findFirst: jest.fn().mockResolvedValue({
        activeVersion: {
          versionNo: 2,
          workouts: [
            {
              id: "recorded",
              scheduledDate: new Date("2030-01-14Z"),
              title: "已记录课程",
              structure: { segments: [] },
            },
          ],
        },
      }),
    },
    trainingActivity: {
      findMany: jest.fn().mockResolvedValue([{ workoutId: "recorded" }]),
    },
    trainingAssessment: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { protocol: "FTP", localDate: new Date("2030-01-16Z") },
        ]),
    },
    trainingStage: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "stage",
          title: "减量阶段",
          startDate: new Date("2030-01-09Z"),
          endDate: new Date("2030-01-20Z"),
        },
      ]),
    },
  };
  return { db, service: new RaceImpactService(db as unknown as PrismaService) };
}
beforeEach(() =>
  jest.useFakeTimers().setSystemTime(new Date("2030-01-09T03:00:00Z")),
);
afterEach(() => jest.useRealTimers());

test("preview includes next-week tests, races, stages and retained training records", async () => {
  const { db, service } = fixture();
  const result = await service.preview("owner", "race", {
    startDate: "2030-01-09",
    endDate: "2030-01-20",
  });
  expect(result.workouts).toEqual([
    { id: "recorded", date: "2030-01-14", title: "已记录课程", retained: true },
  ]);
  expect(result.conflicts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ date: "2030-01-16", kind: "ASSESSMENT" }),
      expect.objectContaining({
        date: "2030-01-19",
        kind: "RACE",
        severity: "WARNING",
      }),
    ]),
  );
  expect(result.stages[0].title).toBe("减量阶段");
  expect(result.messages.some((message) => message.includes("A/B/C"))).toBe(
    true,
  );
  expect(result.race).not.toHaveProperty("userId");
  expect(
    db.trainingAssessment.findMany.mock.calls[0][0].where.localDate,
  ).toEqual({ gte: new Date("2030-01-09Z"), lte: new Date("2030-01-20Z") });
});
test("foreign events and oversized ranges fail before reading plan details", async () => {
  const { db, service } = fixture();
  await expect(
    service.preview("owner", "race", {
      startDate: "2030-01-09",
      endDate: "2031-01-20",
    }),
  ).rejects.toBeDefined();
  db.trainingRace.findFirst.mockResolvedValue(null);
  await expect(service.preview("other", "race")).rejects.toMatchObject({
    response: { code: "RACE_NOT_FOUND" },
  });
  expect(db.trainingPlan.findFirst).not.toHaveBeenCalled();
});
