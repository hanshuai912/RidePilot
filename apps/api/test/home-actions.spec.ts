import { HomeActionsService } from "../src/modules/home/home-actions.service";
import type { PrismaService } from "../src/infra/prisma/prisma.service";
import type { CoachOverviewService } from "../src/modules/coach/coach-overview.service";
import type { CoachSuggestionsService } from "../src/modules/coach/coach-suggestions.service";
const id = "00000000-0000-4000-8000-000000000001";
const overview = {
  localDate: "2030-01-07",
  timezone: "Asia/Shanghai",
  planVersion: 1,
  goal: null,
  stage: null,
  stageNotice: null,
  status: {
    code: "RECOVERING",
    label: "优先恢复",
    explanation: "近期反馈疲劳较高",
    evidence: [
      {
        id,
        date: "2030-01-07",
        title: "训练反馈",
        kind: "ACTIVITY",
        detail: "疲劳 8/10",
      },
    ],
  },
  nextWorkout: null,
  upcomingWorkouts: [],
  nextAssessment: { id, date: "2030-01-08", title: "FTP 测试", overdue: false },
  versions: [],
};
test("home reuses explainable status and owner-scoped next events, excluding cancelled and past races", async () => {
  const prisma = {
    trainingRace: {
      findFirst: jest.fn().mockResolvedValue({
        id,
        name: "公路赛",
        localDate: new Date("2030-01-09T00:00:00Z"),
        priority: "B",
      }),
    },
  };
  const readOverview = { get: jest.fn().mockResolvedValue(overview) };
  const suggestions = {
    list: jest.fn().mockResolvedValue({ pending: [], recent: [] }),
  };
  const service = new HomeActionsService(
    prisma as unknown as PrismaService,
    readOverview as unknown as CoachOverviewService,
    suggestions as unknown as CoachSuggestionsService,
  );
  const result = await service.get(id, "2030-01-07");
  expect(result.overview.status).toEqual(overview.status);
  expect(result.overview.nextAssessment?.date).toBe("2030-01-08");
  expect(result.nextRace).toEqual({
    id,
    date: "2030-01-09",
    title: "公路赛",
    priority: "B",
  });
  expect(prisma.trainingRace.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        userId: id,
        status: "CONFIRMED",
        localDate: { gte: new Date("2030-01-07T00:00:00Z") },
      },
    }),
  );
});
