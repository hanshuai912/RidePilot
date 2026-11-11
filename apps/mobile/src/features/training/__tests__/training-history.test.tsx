import { Text } from "react-native";
import { Stack, usePathname } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library";
import type { TrainingHistoryResponse } from "@ridepilot/contracts";
import LegacyCycleReviewRoute from "../../../../app/(tabs)/coach/cycle-review";
import { TrainingHistoryScreen } from "../screens/TrainingHistoryScreen";
import { WorkoutDetailScreen } from "../screens/WorkoutDetailScreen";
import { trainingApi } from "../services/training.api";

jest.mock("../../auth/hooks/AuthProvider", () => ({
  useAuth: () => ({ session: { accessToken: "token", user: { id: "user" } } }),
}));
jest.mock("../services/training.api", () => ({
  trainingApi: {
    history: jest.fn(),
    getHistoryWorkout: jest.fn(),
    getWorkout: jest.fn(),
  },
}));
const api = jest.mocked(trainingApi);
const workout = {
  id: "00000000-0000-4000-8000-000000000001",
  planVersion: 1,
  sportType: "cycling" as const,
  source: "manual" as const,
  title: "耐力骑行",
  purpose: "基础耐力",
  scheduledDate: "2030-01-07",
  dayOrder: 1,
  timeTargetMinutes: 30,
  distanceTargetKm: null,
  editable: false,
  activity: null,
  segments: [
    {
      type: "work" as const,
      target: { kind: "duration" as const, value: 30, unit: "min" as const },
      intensity: { kind: "power_watt" as const, min: 100, max: 150 },
    },
  ],
};
const older = {
  ...workout,
  id: "00000000-0000-4000-8000-000000000002",
  scheduledDate: "2029-08-01",
  title: "更早的课程",
};
const page: TrainingHistoryResponse = {
  items: [workout],
  nextCursor: null,
  localDate: "2030-01-08",
  timezone: "Asia/Shanghai",
};
beforeEach(() => {
  jest.resetAllMocks();
  api.history.mockResolvedValue(page);
  api.getHistoryWorkout.mockResolvedValue(workout);
});
async function open(initialUrl = "/training-history") {
  await renderRouter(
    {
      _layout: function Layout() {
        return (
          <>
            <Text testID="history-path">{usePathname()}</Text>
            <Stack screenOptions={{ headerShown: false }} />
          </>
        );
      },
      "(tabs)/profile": () => <Text>我的页面</Text>,
      "training-history": TrainingHistoryScreen,
      "workouts/[workoutId]": WorkoutDetailScreen,
      "(tabs)/coach/cycle-review": LegacyCycleReviewRoute,
    },
    { initialUrl },
  );
}

test("shows a date ordered list without the previous filters or summaries", async () => {
  api.history.mockResolvedValue({
    ...page,
    items: [
      workout,
      { ...older, scheduledDate: workout.scheduledDate, dayOrder: 2 },
      { ...older, id: "00000000-0000-4000-8000-000000000003" },
    ],
  });
  await open();
  await screen.findByRole("button", { name: "2030-01-07 耐力骑行" });
  expect(screen.getByRole("header", { name: "训练历史" })).toBeTruthy();
  expect(
    screen
      .getAllByRole("button")
      .map((b) => b.props.accessibilityLabel)
      .filter((v) => /^\d{4}-/.test(v ?? "")),
  ).toEqual([
    "2030-01-07 耐力骑行",
    "2030-01-07 更早的课程",
    "2029-08-01 更早的课程",
  ]);
  for (const text of [
    "复盘时间范围",
    "最近七天",
    "训练周期复盘",
    "当前最近三天反馈",
    "后续训练",
    "复盘与后续计划历史",
  ])
    expect(screen.queryByText(text)).toBeNull();
  expect(api.history).toHaveBeenCalledWith("token");
});

test("opens the exact historical workout read-only and returns to history", async () => {
  await open();
  await fireEvent.press(
    await screen.findByRole("button", { name: "2030-01-07 耐力骑行" }),
  );
  await screen.findByRole("header", { name: "课程详情" });
  await waitFor(() =>
    expect(api.getHistoryWorkout).toHaveBeenCalledWith("token", workout.id),
  );
  await screen.findByText("耐力骑行");
  expect(api.getWorkout).not.toHaveBeenCalled();
  expect(screen.queryByText("记录训练反馈")).toBeNull();
  expect(screen.queryByText("让 AI 调整这节课")).toBeNull();
  expect(screen.queryByText("编辑动作")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  await screen.findByRole("header", { name: "训练历史" });
  expect(screen.getByTestId("history-path")).toHaveTextContent(
    "/training-history",
  );
});

test("appends earlier pages without duplicates and retries a failed page without losing rows", async () => {
  api.history
    .mockResolvedValueOnce({ ...page, nextCursor: "next" })
    .mockRejectedValueOnce(new Error("加载中断"))
    .mockResolvedValueOnce({ ...page, items: [workout, older] });
  await open();
  await fireEvent.press(await screen.findByText("加载更早训练"));
  await screen.findByText("加载中断");
  expect(
    screen.getByRole("button", { name: "2030-01-07 耐力骑行" }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByText("重试加载更早训练"));
  await screen.findByRole("button", { name: "2029-08-01 更早的课程" });
  expect(api.history.mock.calls.slice(1)).toEqual([
    ["token", "next"],
    ["token", "next"],
  ]);
  expect(
    screen.getAllByRole("button", { name: "2030-01-07 耐力骑行" }),
  ).toHaveLength(1);
  expect(screen.queryByText("加载更早训练")).toBeNull();
});

test("prevents repeated page submissions while an earlier page is loading", async () => {
  let finish!: (v: TrainingHistoryResponse) => void;
  api.history
    .mockResolvedValueOnce({ ...page, nextCursor: "next" })
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
  await open();
  const button = await screen.findByText("加载更早训练");
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(api.history).toHaveBeenCalledTimes(2);
  await act(async () => finish({ ...page, items: [older] }));
  await screen.findByText("更早的课程");
});

test("shows empty and failed states and retries the first page", async () => {
  api.history
    .mockRejectedValueOnce(new Error("历史读取失败"))
    .mockResolvedValueOnce({ ...page, items: [] });
  await open();
  await screen.findByText("历史读取失败");
  expect(screen.queryByText("暂无训练历史")).toBeNull();
  await fireEvent.press(screen.getByText("重试加载训练历史"));
  await screen.findByText("暂无训练历史");
  expect(api.history).toHaveBeenCalledTimes(2);
});

test("a direct history entry returns to profile, and a legacy review link opens history", async () => {
  await open("/coach/cycle-review?startDate=invalid&generationId=old-job");
  await screen.findByRole("header", { name: "训练历史" });
  expect(screen.getByTestId("history-path")).toHaveTextContent(
    "/training-history",
  );
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  await screen.findByText("我的页面");
});

test("displays zero actual minutes without substituting planned time", async () => {
  api.history.mockResolvedValue({
    ...page,
    items: [
      {
        ...workout,
        activity: {
          id: older.id,
          status: "SKIPPED",
          durationMin: 0,
          rpe: null,
          fatigue: null,
          notes: null,
        },
      },
    ],
  });
  await open();
  await screen.findByText("已跳过 · 实际 0 分钟");
  expect(screen.queryByText("未记录 · 计划 30 分钟")).toBeNull();
});
