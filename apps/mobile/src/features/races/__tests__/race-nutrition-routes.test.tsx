import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { router, Stack } from "expo-router";
import { Button } from "../../../components/ui";
import type { NutritionProposalResponse } from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";
import { RaceDetailScreen } from "../screens/RaceDetailScreen";
import { RaceNutritionProposalScreen } from "../screens/RaceNutritionProposalScreen";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: {
    race: jest.fn(),
    raceImpact: jest.fn(),
    raceResult: jest.fn(),
  },
}));
jest.mock("../../nutrition/services/nutrition.api", () => ({
  nutritionApi: {
    raceState: jest.fn(),
    getPlan: jest.fn(),
    generate: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
    apply: jest.fn(),
    validate: jest.fn(),
  },
}));

const coach = jest.mocked(coachApi);
const nutrition = jest.mocked(nutritionApi);
const raceId = "00000000-0000-4000-8000-000000000001";
const ready = {
  generationId: "00000000-0000-4000-8000-000000000002",
  proposalId: "00000000-0000-4000-8000-000000000003",
  status: "READY" as const,
  errorCode: null,
  requestId: null,
};
const queued = { ...ready, status: "QUEUED" as const, proposalId: null };
const proposal: NutritionProposalResponse = {
  proposalId: ready.proposalId,
  proposalType: "AI_PLAN",
  status: "READY",
  baseNutritionVersion: 0,
  proposalVersion: 1,
  original: null,
  draft: {
    startDate: "2030-06-07",
    endDate: "2030-06-11",
    dailyTarget: null,
    items: [
      {
        localDate: "2030-06-09",
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
  validation: { passed: true, warnings: [], blockers: [] },
  metadata: {
    summary: "赛事补给草稿已生成",
    assumptions: [],
    warnings: [],
    blockers: [],
    sourceRefs: [],
    confidence: "MEDIUM",
    model: "test",
    skillVersion: "test",
    skillHash: "test",
  },
};
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  "races/[raceId]": RaceDetailScreen,
  "races/nutrition-proposal": RaceNutritionProposalScreen,
  cover: () => <Button onPress={() => router.back()}>继续补给草稿</Button>,
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    session: { accessToken: "token" },
  } as ReturnType<typeof useAuth>);
  coach.race.mockResolvedValue({
    id: raceId,
    name: "公路赛事",
    localDate: "2030-06-09",
    distanceKm: 120,
    timezone: "Asia/Shanghai",
    priority: "A",
    status: "CONFIRMED",
    type: "ROAD_RACE",
    elevationGainM: 1000,
    intent: "FINISH",
    version: 1,
  } as Awaited<ReturnType<typeof coachApi.race>>);
  coach.raceImpact.mockResolvedValue(
    null as unknown as Awaited<ReturnType<typeof coachApi.raceImpact>>,
  );
  coach.raceResult.mockResolvedValue(null);
  nutrition.raceState.mockResolvedValue({ generation: null, proposal: null });
  nutrition.getPlan.mockResolvedValue({
    planId: null,
    version: 0,
    status: "NOT_GENERATED",
    timezone: "Asia/Shanghai",
    from: "2030-06-09",
    to: "2030-06-09",
    dailyTarget: null,
    items: [],
  });
  nutrition.generate.mockResolvedValue(ready);
  nutrition.generation.mockResolvedValue(ready);
  nutrition.proposal.mockResolvedValue(proposal);
});
afterEach(() => {
  jest.useRealTimers();
});

async function openFromRace() {
  await renderRouter(routes, { initialUrl: `/races/${raceId}` });
  await waitFor(() =>
    expect(screen.getByText("生成赛事补给草稿")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("生成赛事补给草稿"));
}

test("从赛事详情点击后通过真实路由展示补给草稿，保持未应用", async () => {
  await openFromRace();
  await waitFor(() =>
    expect(screen.getByText("赛事补给草稿已生成")).toBeTruthy(),
  );
  expect(screen.queryByLabelText("正在生成赛事补给草稿")).toBeNull();
  expect(nutrition.generate).toHaveBeenCalledTimes(1);
  expect(nutrition.generate).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      mode: "RACE_LINKED",
      raceId,
      startDate: "2030-06-07",
      endDate: "2030-06-11",
    }),
  );
  expect(nutrition.apply).not.toHaveBeenCalled();
});

test("真实路由中排队和运行状态最终转为模型失败提示，可以重试", async () => {
  jest.useFakeTimers();
  nutrition.generate.mockResolvedValueOnce(queued);
  nutrition.generation
    .mockResolvedValueOnce({ ...queued, status: "RUNNING" })
    .mockResolvedValueOnce({
      ...queued,
      status: "FAILED",
      errorCode: "AI_PROVIDER_INVALID_RESPONSE",
    });
  await openFromRace();
  expect(screen.getByText("补给草稿已提交，正在排队")).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1500);
  });
  expect(screen.getByText("正在生成并校验赛事补给草稿")).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1500);
  });
  expect(screen.getByText("生成服务返回了无效响应，请稍后重试")).toBeTruthy();
  expect(screen.queryByLabelText("正在生成赛事补给草稿")).toBeNull();
  await fireEvent.press(screen.getByText("重试"));
  await waitFor(() =>
    expect(screen.getByText("赛事补给草稿已生成")).toBeTruthy(),
  );
});

test("请求未返回也会整体超时，重试继续原请求而不重复提交", async () => {
  jest.useFakeTimers();
  let complete!: (value: typeof ready) => void;
  nutrition.generate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await openFromRace();
  expect(nutrition.generate).toHaveBeenCalledTimes(1);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(180_000);
  });
  expect(
    screen.getByText("补给草稿等待超时，可重试继续查询；正式饮食计划没有变化"),
  ).toBeTruthy();
  await fireEvent.press(screen.getByText("重试"));
  await act(async () => {
    complete(ready);
  });
  await waitFor(() =>
    expect(screen.getByText("赛事补给草稿已生成")).toBeTruthy(),
  );
  expect(nutrition.generate).toHaveBeenCalledTimes(1);
});

test("返回赛事再进入补给页能完成，不重复提交仍在进行的任务", async () => {
  jest.useFakeTimers();
  nutrition.generate.mockResolvedValue(queued);
  await openFromRace();
  expect(screen.getByText("补给草稿已提交，正在排队")).toBeTruthy();
  await act(async () => {
    router.push("/cover" as never);
  });
  await fireEvent.press(screen.getByText("继续补给草稿"));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1500);
  });
  await waitFor(() =>
    expect(screen.getByText("赛事补给草稿已生成")).toBeTruthy(),
  );
  expect(nutrition.generate).toHaveBeenCalledTimes(1);
});

test("轮询超时后重试查询同一个后台任务", async () => {
  jest.useFakeTimers();
  nutrition.generate.mockResolvedValue(queued);
  nutrition.generation.mockResolvedValue(queued);
  await openFromRace();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(151_500);
  });
  expect(
    screen.getByText("生成等待超时，请重试；正式饮食计划没有变化"),
  ).toBeTruthy();
  nutrition.generation.mockResolvedValue(ready);
  await fireEvent.press(screen.getByText("重试"));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1500);
  });
  expect(screen.getByText("赛事补给草稿已生成")).toBeTruthy();
  expect(nutrition.generate).toHaveBeenCalledTimes(1);
});

test("应用后再次进入会查看已有方案，不生成或重复应用", async () => {
  nutrition.apply.mockImplementation(async () => {
    nutrition.raceState.mockResolvedValue({
      generation: ready,
      proposal: { ...proposal, status: "APPLIED" },
    });
    return {
      success: true,
      newNutritionVersion: 1,
      affectedDates: ["2030-06-09"],
    };
  });
  await openFromRace();
  await waitFor(() =>
    expect(screen.getByText("确认应用到正式计划")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("确认应用到正式计划"));
  await waitFor(() =>
    expect(screen.getByText("查看赛事补给方案")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("查看赛事补给方案"));
  await waitFor(() =>
    expect(screen.getByText("AI 营养方案 · 已应用")).toBeTruthy(),
  );
  expect(screen.queryByText("确认应用到正式计划")).toBeNull();
  expect(screen.queryByText("重新校验草稿")).toBeNull();
  expect(nutrition.generate).toHaveBeenCalledTimes(1);
  expect(nutrition.apply).toHaveBeenCalledTimes(1);
});

test("重新打开页面可恢复已应用赛事方案，无需再次调用生成接口", async () => {
  nutrition.raceState.mockResolvedValue({
    generation: ready,
    proposal: { ...proposal, status: "APPLIED" },
  });
  await renderRouter(routes, {
    initialUrl: `/races/nutrition-proposal?raceId=${raceId}`,
  });
  await waitFor(() =>
    expect(screen.getByText("AI 营养方案 · 已应用")).toBeTruthy(),
  );
  expect(nutrition.generate).not.toHaveBeenCalled();
  expect(nutrition.apply).not.toHaveBeenCalled();
});

test("已生成的草稿与进行中的任务都从服务端恢复", async () => {
  nutrition.raceState.mockResolvedValue({ generation: ready, proposal });
  await renderRouter(routes, { initialUrl: `/races/${raceId}` });
  await waitFor(() =>
    expect(screen.getByText("查看赛事补给草稿")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("查看赛事补给草稿"));
  await waitFor(() =>
    expect(screen.getByText("赛事补给草稿已生成")).toBeTruthy(),
  );
  expect(nutrition.generate).not.toHaveBeenCalled();
});

test("已应用方案内可显式重新生成，仍需确认后才应用新草稿", async () => {
  nutrition.raceState.mockResolvedValue({
    generation: ready,
    proposal: { ...proposal, status: "APPLIED" },
  });
  nutrition.getPlan.mockResolvedValue({
    planId: raceId,
    version: 1,
    status: "ACTIVE",
    timezone: "Asia/Shanghai",
    from: "2030-06-09",
    to: "2030-06-09",
    dailyTarget: null,
    items: [],
  });
  await renderRouter(routes, {
    initialUrl: `/races/nutrition-proposal?raceId=${raceId}`,
  });
  await waitFor(() =>
    expect(screen.getByText("AI 营养方案 · 已应用")).toBeTruthy(),
  );
  expect(nutrition.generate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("重新生成赛事补给"));
  await waitFor(() =>
    expect(screen.getByText("确认应用到正式计划")).toBeTruthy(),
  );
  expect(nutrition.generate).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      raceId,
      forceRegenerate: true,
      expectedNutritionVersion: 1,
    }),
  );
  expect(nutrition.apply).not.toHaveBeenCalled();
});
