import { act, fireEvent, render } from "@testing-library/react-native";
import type { CoachOverview, CoachSuggestions } from "@ridepilot/contracts";
import { useCoachFlow } from "../hooks/CoachFlowContext";
import { CoachScreen } from "../screens/CoachScreen";
import { coachCenterApi } from "../services/coach-center.api";
import { trainingApi } from "../../training/services/training.api";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
  usePathname: () => "/coach",
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
  jest.mocked(useCoachFlow).mockReturnValue(flow);
  api.overview.mockResolvedValue(overview);
  api.suggestions.mockResolvedValue(emptySuggestions);
  workoutApi.getWorkout.mockRejectedValue(new Error("详情离线"));
});
afterEach(() => {
  jest.useRealTimers();
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
  expect(ui.getByText("重新规划")).toBeTruthy();
  expect(api.overview).toHaveBeenCalledTimes(1);
  expect(api.suggestions).toHaveBeenCalledTimes(1);
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
  expect(api.overview).not.toHaveBeenCalled();
  expect(workoutApi.getWorkout).not.toHaveBeenCalled();
});
