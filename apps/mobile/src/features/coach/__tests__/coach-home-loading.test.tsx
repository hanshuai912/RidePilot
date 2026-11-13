import { act, fireEvent, render } from "@testing-library/react-native";
import type { CoachOverview, CoachSuggestions } from "@ridepilot/contracts";
import { useCoachFlow } from "../hooks/CoachFlowContext";
import { CoachScreen } from "../screens/CoachScreen";
import { coachCenterApi } from "../services/coach-center.api";
import { trainingApi } from "../../training/services/training.api";

const mockPush = jest.fn();
let mockPathname = "/coach";
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: mockPush }),
}));
jest.mock("../hooks/CoachFlowContext", () => ({ useCoachFlow: jest.fn() }));
jest.mock("../services/coach-center.api", () => ({
  coachCenterApi: { overview: jest.fn(), suggestions: jest.fn() },
}));
jest.mock("../../training/services/training.api", () => ({
  trainingApi: { getWorkout: jest.fn() },
}));

const api = jest.mocked(coachCenterApi);
const workoutApi = jest.mocked(trainingApi);
const overview: CoachOverview = {
  localDate: "2030-01-09",
  timezone: "Asia/Shanghai",
  planVersion: 2,
  goal: null,
  stage: null,
  stageNotice: null,
  status: {
    code: "INSUFFICIENT",
    label: "暂无充分状态依据",
    explanation: "缺少反馈",
    evidence: [],
  },
  nextWorkout: {
    id: "workout",
    date: "2030-01-09",
    title: "今日耐力训练",
    minutes: 60,
  },
  upcomingWorkouts: [],
  nextAssessment: null,
  versions: [],
};
const emptySuggestions: CoachSuggestions = { pending: [], recent: [] };
// Only homepage fields are needed; other flow stages are covered separately.
const flow = {
  token: "token",
  stage: "entry",
  loading: false,
  busy: false,
  error: null,
  beginTask: jest.fn(),
  resources: {
    profile: { timezone: "Asia/Shanghai" },
    readiness: { ready: true, missingFields: [] },
    planStatus: { hasActivePlan: true, planVersion: 2 },
  },
} as unknown as ReturnType<typeof useCoachFlow>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function settle(action: () => void) {
  await act(async () => {
    action();
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockPathname = "/coach";
  jest.mocked(useCoachFlow).mockReturnValue(flow);
  api.overview.mockResolvedValue(overview);
  api.suggestions.mockResolvedValue(emptySuggestions);
  workoutApi.getWorkout.mockRejectedValue(new Error("详情离线"));
});

it("keeps the homepage when opening a goal after a previous adjustment task", async () => {
  jest
    .mocked(useCoachFlow)
    .mockReturnValue({ ...flow, stage: "planning", task: "REPLAN" });
  api.overview.mockResolvedValue({
    ...overview,
    goal: { id: "goal-id", title: "提升耐力" },
  });
  const ui = await render(<CoachScreen />);
  await ui.findByText("今日耐力训练");
  await fireEvent.press(ui.getByRole("button", { name: "查看目标与阶段" }));
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: "/goals/[goalId]",
    params: { goalId: "goal-id" },
  });
  mockPathname = "/goals/goal-id";
  await ui.rerender(<CoachScreen />);
  expect(ui.getByTestId("coach-dashboard-sections")).toBeTruthy();
  expect(ui.queryByTestId("coach-replan-brief")).toBeNull();
  expect(mockPush).toHaveBeenCalledTimes(1);
  mockPathname = "/coach";
  await ui.rerender(<CoachScreen />);
  expect(ui.getByTestId("coach-dashboard-sections")).toBeTruthy();
});
afterEach(() => {
  jest.useRealTimers();
});

it("shows recovery as one form with one draft action, keeps the error inline and returns to the coach", async () => {
  mockPathname = "/coach/planning";
  const recoveryFlow = {
    ...flow,
    stage: "planning" as const,
    task: "RECOVERY" as const,
    planningScope: "THIS_WEEK" as const,
    bodyStatus: "TIRED" as const,
    taskNote: "周日完成公路赛",
    setPlanningScope: jest.fn(),
    setBodyStatus: jest.fn(),
    setTaskNote: jest.fn(),
    submitTask: jest.fn(),
    cancelTask: jest.fn(),
    error: "读取训练日历失败",
    resources: { ...flow.resources!, goals: [] },
  };
  jest.mocked(useCoachFlow).mockReturnValue(recoveryFlow);
  const ui = await render(<CoachScreen />);
  expect(
    ui.getAllByText("选择当前感受和调整范围，再补充比赛情况。"),
  ).toHaveLength(1);
  expect(ui.queryByTestId("coach-replan-brief")).toBeNull();
  expect(ui.getByText("读取训练日历失败")).toBeTruthy();
  expect(ui.getByLabelText("比赛与恢复情况").props.value).toBe(
    "周日完成公路赛",
  );
  const primary = ui.getByRole("button", { name: "生成恢复草稿" });
  await fireEvent.press(primary);
  expect(recoveryFlow.submitTask).toHaveBeenCalledTimes(1);
  await fireEvent.press(ui.getByRole("button", { name: "返回上一页" }));
  expect(recoveryFlow.cancelTask).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/coach");
});

it("exposes recovery and history without expanding a menu, even without pending suggestions", async () => {
  const ui = await render(<CoachScreen />);
  await ui.findByText("调整训练");
  expect(ui.queryByTestId("coach-pending-suggestions")).toBeNull();
  expect(ui.queryByRole("button", { name: "更多操作" })).toBeNull();
  for (const name of [
    "规划下周",
    "目标阶段与按范围生成课程",
    "赛事管理与新增比赛",
    "最近计划版本",
  ])
    expect(ui.queryByRole("button", { name })).toBeNull();
  await fireEvent.press(ui.getByRole("button", { name: "赛后恢复" }));
  expect(flow.beginTask).toHaveBeenCalledWith("RECOVERY");
  expect(mockPush).toHaveBeenLastCalledWith("/(tabs)/coach/planning");
  await fireEvent.press(ui.getByRole("button", { name: "全部建议与历史" }));
  expect(mockPush).toHaveBeenLastCalledWith("/(tabs)/coach/suggestions");
});

it("uses one loader across profile, overview, suggestions and workout detail, then shows content", async () => {
  const profileFlow = { ...flow, resources: null, loading: true };
  jest.mocked(useCoachFlow).mockReturnValue(profileFlow);
  const summary = deferred<CoachOverview>();
  const suggestions = deferred<CoachSuggestions>();
  const detail = deferred<Awaited<ReturnType<typeof trainingApi.getWorkout>>>();
  api.overview.mockReturnValue(summary.promise);
  api.suggestions.mockReturnValue(suggestions.promise);
  workoutApi.getWorkout.mockReturnValue(detail.promise);
  const ui = await render(<CoachScreen />);
  expect(ui.getAllByLabelText(/读取/)).toHaveLength(1);
  expect(api.overview).not.toHaveBeenCalled();
  jest.mocked(useCoachFlow).mockReturnValue(flow);
  await ui.rerender(<CoachScreen />);
  expect(ui.getAllByLabelText(/读取/)).toHaveLength(1);
  await settle(() => summary.resolve(overview));
  expect(workoutApi.getWorkout).toHaveBeenCalledWith("token", "workout");
  expect(ui.getAllByLabelText(/读取/)).toHaveLength(1);
  await settle(() => suggestions.resolve(emptySuggestions));
  expect(ui.getAllByLabelText(/读取/)).toHaveLength(1);
  await settle(() => detail.reject(new Error("详情离线")));
  expect(ui.queryAllByLabelText(/读取/)).toHaveLength(0);
  expect(ui.getByText("今日耐力训练")).toBeTruthy();
  expect(ui.getByText("强度详情暂不可用")).toBeTruthy();
  expect(ui.getByText("调整训练")).toBeTruthy();
  expect(ui.getAllByRole("button", { name: "问 AI 教练" })).toHaveLength(1);
  expect(ui.queryByText("问 AI 教练")).toBeNull();
  expect(ui.queryByText("训练日历")).toBeNull();
  await fireEvent.press(ui.getByRole("button", { name: "问 AI 教练" }));
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/coach/chat");
  expect(api.overview).toHaveBeenCalledTimes(1);
  expect(api.suggestions).toHaveBeenCalledTimes(1);
});

it("keeps one history entry alongside a pending suggestion", async () => {
  api.suggestions.mockResolvedValue({
    pending: [
      {
        id: "draft",
        kind: "TRAINING",
        title: "调整恢复训练",
        summary: "待核对训练安排",
        status: "READY",
        version: 1,
        createdAt: "2030-01-09T00:00:00Z",
        goalId: null,
        staleReason: null,
      },
    ],
    recent: [],
  });
  const ui = await render(<CoachScreen />);
  await ui.findByText("调整恢复训练");
  expect(ui.getByText("1 条待处理")).toBeTruthy();
  expect(ui.getAllByRole("button", { name: "全部建议与历史" })).toHaveLength(1);
  expect(ui.queryByRole("button", { name: "查看全部建议与历史" })).toBeNull();
  await fireEvent.press(ui.getByRole("button", { name: "全部建议与历史" }));
  expect(mockPush).toHaveBeenLastCalledWith("/(tabs)/coach/suggestions");
});

it("waits for all requests after partial failure and retries only the failed suggestions", async () => {
  const summary = deferred<CoachOverview>();
  api.overview.mockReturnValue(summary.promise);
  api.suggestions.mockRejectedValueOnce(new Error("建议离线"));
  const ui = await render(<CoachScreen />);
  expect(ui.getAllByLabelText(/读取/)).toHaveLength(1);
  await settle(() => summary.resolve({ ...overview, nextWorkout: null }));
  expect(ui.queryAllByLabelText(/读取/)).toHaveLength(0);
  expect(ui.getByText("建议暂不可用：建议离线")).toBeTruthy();
  const retry = deferred<CoachSuggestions>();
  api.suggestions.mockReturnValueOnce(retry.promise);
  await fireEvent.press(ui.getByText("刷新建议"));
  expect(ui.getAllByLabelText(/读取/)).toHaveLength(1);
  await settle(() => retry.resolve(emptySuggestions));
  expect(ui.queryAllByLabelText(/读取/)).toHaveLength(0);
  expect(api.overview).toHaveBeenCalledTimes(1);
  expect(api.suggestions).toHaveBeenCalledTimes(2);
});

it("keeps overview errors recoverable after the single loader ends", async () => {
  api.overview.mockRejectedValueOnce(new Error("概览离线"));
  const ui = await render(<CoachScreen />);
  expect(ui.getByText("暂时无法读取训练概览")).toBeTruthy();
  expect(ui.queryAllByLabelText(/读取/)).toHaveLength(0);
  expect(ui.getByRole("button", { name: "赛后恢复" })).toBeTruthy();
  expect(ui.getByRole("button", { name: "全部建议与历史" })).toBeTruthy();
  await fireEvent.press(ui.getByText("重新读取概览"));
  expect(ui.getByText("今日耐力训练")).toBeTruthy();
  expect(api.overview).toHaveBeenCalledTimes(2);
  expect(api.suggestions).toHaveBeenCalledTimes(1);
});

it("does not replace content with loading while polling a generation job", async () => {
  jest.useFakeTimers();
  api.suggestions.mockResolvedValueOnce({
    pending: [
      {
        id: "job",
        kind: "GENERATION",
        title: "计划生成中",
        summary: "等待生成完成",
        status: "RUNNING",
        version: 1,
        createdAt: "2030-01-09T00:00:00Z",
        goalId: null,
        staleReason: null,
      },
    ],
    recent: [],
  });
  const ui = await render(<CoachScreen />);
  expect(ui.getByText("计划生成中")).toBeTruthy();
  const poll = deferred<CoachSuggestions>();
  api.suggestions.mockReturnValueOnce(poll.promise);
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(ui.queryAllByLabelText(/读取/)).toHaveLength(0);
  expect(ui.getByText("今日耐力训练")).toBeTruthy();
  await settle(() => poll.resolve(emptySuggestions));
  expect(ui.queryByText("计划生成中")).toBeNull();
  expect(api.overview).toHaveBeenCalledTimes(1);
  expect(workoutApi.getWorkout).toHaveBeenCalledTimes(1);
});

it("loads only suggestions for users without a plan, then shows onboarding", async () => {
  jest.mocked(useCoachFlow).mockReturnValue({
    ...flow,
    resources: {
      ...flow.resources!,
      planStatus: { ...flow.resources!.planStatus, hasActivePlan: false },
    },
  });
  const suggestions = deferred<CoachSuggestions>();
  api.suggestions.mockReturnValue(suggestions.promise);
  const ui = await render(<CoachScreen />);
  expect(ui.getAllByLabelText(/读取/)).toHaveLength(1);
  await settle(() => suggestions.resolve(emptySuggestions));
  expect(ui.queryAllByLabelText(/读取/)).toHaveLength(0);
  expect(ui.getByText("开始建立计划")).toBeTruthy();
  expect(ui.getAllByRole("button", { name: "问 AI 教练" })).toHaveLength(1);
  expect(api.overview).not.toHaveBeenCalled();
  expect(workoutApi.getWorkout).not.toHaveBeenCalled();
});
