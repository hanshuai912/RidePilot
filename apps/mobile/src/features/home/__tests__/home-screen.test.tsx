import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { router } from "expo-router";
import type {
  CalendarResponse,
  HomeTodayResponse,
  NutritionPlanResponse,
} from "@ridepilot/contracts";
import { HomeScreen } from "../screens/HomeScreen";
import { useHomeData } from "../hooks/useHomeData";
import { homeApi } from "../services/home.api";
import { useAuth } from "../../auth/hooks/AuthProvider";

jest.mock(
  "react-native/Libraries/Components/RefreshControl/RefreshControl",
  () => {
    const React = jest.requireActual("react");
    return {
      __esModule: true,
      default: (props: object) =>
        React.createElement("RefreshControl", { ...props, accessible: true }),
    };
  },
);
jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../services/home.api", () => ({ homeApi: { today: jest.fn() } }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, []),
}));
const api = jest.mocked(homeApi);
const workout: CalendarResponse["items"][number] = {
  id: "course-1",
  planVersion: 3,
  sportType: "cycling",
  source: "ai",
  title: "耐力训练",
  purpose: "建立基础",
  scheduledDate: "2026-10-30",
  dayOrder: 1,
  timeTargetMinutes: 40,
  distanceTargetKm: null,
  editable: true,
  segments: [
    {
      type: "work",
      target: { kind: "duration", value: 40, unit: "min" },
      intensity: { kind: "power_watt", min: 100, max: 130 },
    },
  ],
};
const meals: NutritionPlanResponse = {
  planId: "meal-plan",
  version: 2,
  status: "ACTIVE",
  timezone: "Asia/Shanghai",
  from: "2026-10-30",
  to: "2026-10-30",
  dailyTarget: null,
  items: [
    {
      id: "meal-1",
      localDate: "2026-10-30",
      mealType: "BREAKFAST",
      scheduledLocalTime: "08:00",
      title: "燕麦香蕉早餐",
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
        energyKcal: 400,
        carbohydrateG: 60,
        proteinG: 12,
        fatG: 8,
        fluidMl: null,
        sodiumMg: null,
      },
      nutritionSource: "AI_ESTIMATE",
      confidence: "MEDIUM",
      linkedWorkoutId: null,
      notes: null,
      warnings: [],
    },
  ],
};
function response(
  options: {
    items?: CalendarResponse["items"];
    next?: typeof workout | null;
    hasPlan?: boolean;
    date?: string;
    nutrition?: NutritionPlanResponse;
    trainingError?: string;
    nutritionError?: string;
  } = {},
): HomeTodayResponse {
  const date = options.date ?? "2026-10-30";
  return {
    localDate: date,
    profile: {
      userId: "user-1",
      displayName: "小明",
      timezone: "Asia/Shanghai",
    },
    training: options.trainingError
      ? {
          status: "UNAVAILABLE",
          error: { code: "TRAINING_ERROR", message: options.trainingError },
        }
      : {
          status: "READY",
          data: {
            plan: {
              hasActivePlan: options.hasPlan ?? true,
              planVersion: options.hasPlan === false ? 0 : 3,
            },
            calendar: {
              from: date,
              to: date,
              ftpAvailable: true,
              items: options.items ?? [workout],
            },
            nextWorkout: options.next === undefined ? workout : options.next,
          },
        },
    nutrition: options.nutritionError
      ? {
          status: "UNAVAILABLE",
          error: { code: "NUTRITION_ERROR", message: options.nutritionError },
        }
      : { status: "READY", data: options.nutrition ?? meals },
  };
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    session: {
      user: { id: "user-1", phone: "13812345678", phoneVerified: false },
      accessToken: "token",
      expiresAt: Date.now() + 60000,
    },
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
  });
  api.today.mockResolvedValue(response());
});

test("one home request shows real meals and training, with detail, adjustment and feedback routes", async () => {
  const screen = await render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText("燕麦香蕉早餐")).toBeTruthy());
  expect(api.today).toHaveBeenCalledTimes(1);
  expect(api.today).toHaveBeenCalledWith("token");
  expect(screen.getByText("40 分钟")).toBeTruthy();
  expect(screen.queryByText("正式计划 v3")).toBeNull();
  expect(screen.queryByText("刷新今日安排")).toBeNull();
  expect(screen.getAllByLabelText("刷新首页")).toHaveLength(1);
  for (const [label, action] of [
    ["查看今日训练", undefined],
    ["调整这节训练", "adjust"],
    ["记录完成情况", "feedback"],
  ] as const) {
    await fireEvent.press(screen.getByText(label));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/workouts/[workoutId]",
      params: { workoutId: workout.id, ...(action ? { action } : {}) },
    });
  }
  await fireEvent.press(screen.getByText("查看与调整餐食 / 补给"));
  expect(router.push).toHaveBeenLastCalledWith("/(tabs)/nutrition");
});

test("a day without training still shows meals, calendar/create entries and the actual next course", async () => {
  api.today.mockResolvedValue(
    response({ items: [], next: { ...workout, scheduledDate: "2026-11-03" } }),
  );
  const screen = await render(<HomeScreen />);
  await waitFor(() =>
    expect(screen.getByText("今天暂无训练安排")).toBeTruthy(),
  );
  expect(screen.getByText("燕麦香蕉早餐")).toBeTruthy();
  expect(screen.getByText(/下次训练：11 月 3 日/)).toBeTruthy();
  expect(screen.queryByText("调整这节训练")).toBeNull();
  await fireEvent.press(screen.getByText("手动添加今天的训练"));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/workouts/new",
    params: { date: "2026-10-30" },
  });
});

test("no plan and no meals are distinct from a blank day in an active plan", async () => {
  api.today.mockResolvedValue(
    response({
      hasPlan: false,
      items: [],
      next: null,
      nutrition: {
        ...meals,
        planId: null,
        version: 0,
        status: "NOT_GENERATED",
        items: [],
      },
    }),
  );
  const screen = await render(<HomeScreen />);
  await waitFor(() =>
    expect(screen.getByText("尚无正式训练计划")).toBeTruthy(),
  );
  expect(screen.queryByText("今天暂无训练安排")).toBeNull();
  expect(screen.getByText("今天还没有饮食计划")).toBeTruthy();
});

test("an active plan with no future course has an explicit empty state", async () => {
  api.today.mockResolvedValue(response({ items: [], next: null }));
  const screen = await render(<HomeScreen />);
  await waitFor(() =>
    expect(
      screen.getByText("暂未安排后续课程，可在 AI 教练中规划。"),
    ).toBeTruthy(),
  );
  expect(screen.getByText("今天暂无训练安排")).toBeTruthy();
});

test("multiple courses keep independent completion states and actions", async () => {
  api.today.mockResolvedValue(
    response({
      items: [
        {
          ...workout,
          activity: {
            id: "record-1",
            status: "PARTIAL",
            durationMin: 20,
            rpe: 7,
            fatigue: 6,
            notes: null,
          },
          editable: false,
        },
        { ...workout, id: "course-2", dayOrder: 2, title: "恢复骑行" },
      ],
    }),
  );
  const screen = await render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText("恢复骑行")).toBeTruthy());
  expect(screen.getByText(/实际 20 分钟/)).toBeTruthy();
  expect(screen.getAllByText("记录完成情况")).toHaveLength(1);
  await fireEvent.press(screen.getByText("记录完成情况"));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/workouts/[workoutId]",
    params: { workoutId: "course-2", action: "feedback" },
  });
});

test("training partial failure leaves meals visible and retry uses one aggregate request", async () => {
  api.today.mockResolvedValueOnce(response({ trainingError: "训练服务离线" }));
  const screen = await render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText(/训练服务离线/)).toBeTruthy());
  expect(screen.getByText("燕麦香蕉早餐")).toBeTruthy();
  await fireEvent.press(screen.getByText("重试今日训练"));
  await waitFor(() => expect(screen.getByText("耐力训练")).toBeTruthy());
  expect(api.today).toHaveBeenCalledTimes(2);
});

test("pull refresh retains cached courses on failure and updates feedback after success", async () => {
  const screen = await render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText("耐力训练")).toBeTruthy());
  api.today.mockResolvedValueOnce(response({ trainingError: "读取超时" }));
  await fireEvent(screen.getByLabelText("刷新首页"), "refresh");
  await waitFor(() => expect(screen.getByText(/读取超时/)).toBeTruthy());
  expect(screen.getByText("耐力训练")).toBeTruthy();
  expect(screen.queryByText("记录完成情况")).toBeNull();
  api.today.mockResolvedValue(
    response({
      items: [
        {
          ...workout,
          activity: {
            id: "record",
            status: "COMPLETED",
            durationMin: 40,
            rpe: 5,
            fatigue: 3,
            notes: null,
          },
        },
      ],
    }),
  );
  await fireEvent.press(screen.getByText("重试今日训练"));
  await waitFor(() => expect(screen.getByText(/实际 40 分钟/)).toBeTruthy());
  expect(api.today).toHaveBeenCalledTimes(3);
});

test("nutrition partial failure leaves training available", async () => {
  api.today.mockResolvedValue(response({ nutritionError: "饮食服务离线" }));
  const screen = await render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText(/饮食服务离线/)).toBeTruthy());
  expect(screen.getByText("耐力训练")).toBeTruthy();
});

test("foreground and day rollover refresh one endpoint; yesterday's data is discarded", async () => {
  jest.useFakeTimers({ now: new Date("2026-10-30T15:59:55Z") });
  let listener: ((state: AppStateStatus) => void) | undefined;
  const appState = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, callback) => {
      listener = callback;
      return { remove: jest.fn() };
    });
  const { result, unmount } = await renderHook(() => useHomeData("token"));
  await waitFor(() => expect(result.current.date).toBe("2026-10-30"));
  await act(async () => {
    listener?.("active");
  });
  expect(api.today).toHaveBeenCalledTimes(2);
  api.today.mockResolvedValueOnce(
    response({ date: "2026-10-31", trainingError: "新一天离线" }),
  );
  await act(async () => {
    jest.advanceTimersByTime(30_000);
  });
  expect(result.current.date).toBe("2026-10-31");
  expect(result.current.training.data).toBeNull();
  expect(api.today).toHaveBeenCalledTimes(3);
  await unmount();
  appState.mockRestore();
  jest.useRealTimers();
});

test("late responses cannot overwrite newer aggregate data", async () => {
  const { result } = await renderHook(() => useHomeData("token"));
  await waitFor(() => expect(result.current.training.loading).toBe(false));
  let finish!: (value: HomeTodayResponse) => void;
  api.today.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    void result.current.refresh();
  });
  api.today.mockResolvedValueOnce(
    response({ items: [{ ...workout, title: "最新安排" }] }),
  );
  await act(async () => {
    await result.current.refresh();
  });
  await act(async () => {
    finish(response({ items: [] }));
  });
  expect(result.current.training.data?.items[0].title).toBe("最新安排");
});

test("a failed aggregate request retains same-day content and exposes retry", async () => {
  jest.useFakeTimers({ now: new Date("2026-10-30T01:00:00Z") });
  const screen = await render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText("耐力训练")).toBeTruthy());
  api.today.mockRejectedValueOnce(new Error("首页请求超时"));
  await fireEvent(screen.getByLabelText("刷新首页"), "refresh");
  await waitFor(() => expect(screen.getByText(/首页请求超时/)).toBeTruthy());
  expect(screen.getByText("耐力训练")).toBeTruthy();
  expect(screen.getByText("燕麦香蕉早餐")).toBeTruthy();
  expect(screen.queryByText("记录完成情况")).toBeNull();
  jest.useRealTimers();
});
