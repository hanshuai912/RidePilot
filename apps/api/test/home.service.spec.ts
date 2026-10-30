import { HomeService } from "../src/modules/home/home.service";
import type { ProfileService } from "../src/modules/profile/profile.service";
import type { TrainingOverviewService } from "../src/modules/training/training-overview.service";
import type { NutritionPlanService } from "../src/modules/nutrition/nutrition-plan.service";

const userId = "00000000-0000-4000-8000-000000000001";
const profiles = { get: jest.fn() };
const training = { today: jest.fn() };
const nutrition = { get: jest.fn() };
const service = new HomeService(
  profiles as unknown as ProfileService,
  training as unknown as TrainingOverviewService,
  nutrition as unknown as NutritionPlanService,
);
const trainingData = (date: string) => ({
  plan: { hasActivePlan: false, planVersion: 0 },
  calendar: { from: date, to: date, ftpAvailable: false, items: [] },
  nextWorkout: null,
});
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(new Date("2026-10-30T16:30:00Z"));
  profiles.get.mockResolvedValue({
    userId,
    displayName: "骑行者",
    timezone: "Asia/Shanghai",
    phoneMasked: "should-not-leak",
  });
  training.today.mockImplementation(async (_id: string, date: string) =>
    trainingData(date),
  );
  nutrition.get.mockImplementation(
    async (_id: string, query: { date: string }) => ({
      planId: null,
      version: 0,
      status: "NOT_GENERATED",
      timezone: "Asia/Shanghai",
      from: query.date,
      to: query.date,
      dailyTarget: null,
      items: [],
    }),
  );
});
afterEach(() => jest.useRealTimers());
test("uses the authenticated account timezone for both domains and returns only header profile fields", async () => {
  const result = await service.today(userId);
  expect(result.localDate).toBe("2026-10-31");
  expect(training.today).toHaveBeenCalledWith(userId, "2026-10-31");
  expect(nutrition.get).toHaveBeenCalledWith(userId, { date: "2026-10-31" });
  expect(result.profile).toEqual({
    userId,
    displayName: "骑行者",
    timezone: "Asia/Shanghai",
  });
  expect(result.training).toMatchObject({
    status: "READY",
    data: { plan: { hasActivePlan: false }, nextWorkout: null },
  });
});
test.each(["training", "nutrition"] as const)(
  "a failed %s section does not hide the successful section or expose internal errors",
  async (section) => {
    if (section === "training")
      training.today.mockRejectedValue(
        new Error("database credentials must not leak"),
      );
    else
      nutrition.get.mockRejectedValue(
        new Error("database credentials must not leak"),
      );
    const result = await service.today(userId);
    expect(result[section]).toMatchObject({
      status: "UNAVAILABLE",
      error: {
        code:
          section === "training"
            ? "HOME_TRAINING_UNAVAILABLE"
            : "HOME_NUTRITION_UNAVAILABLE",
      },
    });
    expect(
      result[section === "training" ? "nutrition" : "training"].status,
    ).toBe("READY");
    expect(JSON.stringify(result)).not.toContain("credentials");
  },
);
test("both domain failures remain explicit unavailable states, never empty-plan success", async () => {
  training.today.mockRejectedValue(new Error("offline"));
  nutrition.get.mockRejectedValue(new Error("offline"));
  const result = await service.today(userId);
  expect(result.training.status).toBe("UNAVAILABLE");
  expect(result.nutrition.status).toBe("UNAVAILABLE");
});
test("missing account context fails the request without guessing a timezone", async () => {
  profiles.get.mockRejectedValue(new Error("account unavailable"));
  await expect(service.today(userId)).rejects.toThrow("account unavailable");
  expect(training.today).not.toHaveBeenCalled();
  expect(nutrition.get).not.toHaveBeenCalled();
});
