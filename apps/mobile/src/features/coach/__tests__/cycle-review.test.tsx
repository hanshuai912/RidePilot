import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type {
  CycleReviewSnapshot,
  AiProposalResponse,
} from "@ridepilot/contracts";
import { CycleReviewScreen } from "../cycle-review/CycleReviewScreen";
import { CoachSuggestionScreen } from "../screens/CoachSuggestionScreen";
import { cycleReviewApi } from "../cycle-review/cycle-review.api";
import { coachApi } from "../services/coach.api";
import { coachCenterApi } from "../services/coach-center.api";

const mockPush = jest.fn(),
  mockReplace = jest.fn(),
  mockSetParams = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    setParams: mockSetParams,
  }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({
  useAuth: () => ({ session: { accessToken: "token" } }),
}));
jest.mock("../cycle-review/cycle-review.api", () => ({
  cycleReviewApi: { get: jest.fn(), history: jest.fn(), generate: jest.fn() },
}));
jest.mock("../services/coach.api", () => ({
  coachApi: {
    generation: jest.fn(),
    proposal: jest.fn(),
    validate: jest.fn(),
    apply: jest.fn(),
  },
}));
jest.mock("../services/coach-center.api", () => ({
  coachCenterApi: { suggestions: jest.fn() },
}));
jest.mock("../../nutrition/components/TrainingNutritionLinkCard", () => ({
  TrainingNutritionLinkCard: () => null,
}));

const id = "00000000-0000-4000-8000-000000000001",
  jobId = "00000000-0000-4000-8000-000000000002";
const review: CycleReviewSnapshot = {
  startDate: "2030-01-01",
  endDate: "2030-01-07",
  localDate: "2030-01-07",
  timezone: "Asia/Shanghai",
  fingerprint: "a".repeat(64),
  planVersion: 1,
  goal: { id, title: "耐力目标", targetDate: "2030-04-01" },
  stage: null,
  missingFields: [],
  stats: {
    planned: 1,
    completed: 0,
    partial: 0,
    skipped: 0,
    unrecorded: 1,
    completionRate: 0,
    plannedMinutes: 60,
    plannedDurationCount: 1,
    actualMinutes: null,
    actualDurationCount: 0,
    pairedMinutesDelta: null,
    pairedDurationCount: 0,
    rpeAverage: null,
    rpeCount: 0,
    fatigueAverage: null,
    fatigueCount: 0,
    additionalRecords: 0,
  },
  workouts: [
    {
      id,
      date: "2030-01-07",
      title: "今日耐力",
      plannedMinutes: 60,
      inCurrentPlan: true,
      canRecord: true,
      feedback: null,
    },
  ],
  additionalFeedback: [],
  recentFeedback: [],
  tests: [],
  ftp: null,
  recommendation: {
    code: "INSUFFICIENT",
    label: "补充反馈后再判断",
    reasons: ["未记录不等于未完成"],
  },
  notices: ["完成率仅为完成课程占比"],
};
const proposal: AiProposalResponse = {
  proposalId: id,
  proposalVersion: 1,
  basePlanVersion: 1,
  status: "READY",
  scene: "RANGE_PLAN",
  replaceWorkoutIds: [],
  weekStartDate: "2030-01-08",
  endDate: "2030-01-14",
  summary: "后续恢复草稿",
  stageSummary: "当前阶段",
  assessmentSuggestion: "按需测试",
  skillVersion: "v1",
  model: "test",
  warnings: [],
  blockers: [],
  cycleReview: { action: "RECOVERY", snapshot: review },
  workouts: [
    {
      scheduledDate: "2030-01-08",
      title: "恢复骑行",
      purpose: "轻松恢复",
      segments: [
        {
          type: "work",
          target: { kind: "duration", value: 30, unit: "min" },
          intensity: { kind: "ftp_percent", min: 50, max: 65 },
        },
      ],
    },
  ],
};
const api = jest.mocked(cycleReviewApi),
  training = jest.mocked(coachApi);
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  api.get.mockResolvedValue(review);
  api.history.mockResolvedValue({ items: [] });
  api.generate.mockResolvedValue({
    generationId: jobId,
    status: "QUEUED",
    proposalId: null,
    errorCode: null,
    requestId: null,
  });
  training.generation.mockResolvedValue({
    generationId: jobId,
    status: "READY",
    proposalId: id,
    errorCode: null,
    requestId: null,
  });
  training.proposal.mockResolvedValue(proposal);
  training.validate.mockResolvedValue(proposal);
  training.apply.mockResolvedValue({
    success: true,
    newPlanVersion: 2,
    affectedDates: ["2030-01-08"],
  });
  jest
    .mocked(coachCenterApi.suggestions)
    .mockResolvedValue({ pending: [], recent: [] });
});

it("opens and refreshes read-only, keeps unrecorded explicit and returns feedback to the selected review", async () => {
  const screen = await render(<CycleReviewScreen />);
  await waitFor(() =>
    expect(screen.getByText("补充反馈后再判断")).toBeTruthy(),
  );
  expect(api.generate).not.toHaveBeenCalled();
  expect(training.apply).not.toHaveBeenCalled();
  expect(screen.getByText("尚未记录，不视为失败")).toBeTruthy();
  await fireEvent.press(screen.getByText("记录本次训练反馈"));
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: "/workouts/feedback",
    params: {
      workoutId: id,
      source: "cycle-review",
      reviewStartDate: review.startDate,
      reviewEndDate: review.endDate,
    },
  });
  await fireEvent.press(screen.getByText("保留当前计划，前往训练"));
  expect(mockPush).toHaveBeenLastCalledWith("/(tabs)/training");
  expect(api.generate).not.toHaveBeenCalled();
});

it("generates only after explicit direction/date selection and prevents duplicate clicks", async () => {
  let complete!: (v: Awaited<ReturnType<typeof api.generate>>) => void;
  api.generate.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const screen = await render(<CycleReviewScreen />);
  await waitFor(() => screen.getByText("生成恢复训练"));
  await fireEvent.press(screen.getByText("生成恢复训练"));
  expect(api.generate).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("后续训练开始日期"),
    "2030-01-09",
  );
  await fireEvent.changeText(
    screen.getByLabelText("后续训练结束日期"),
    "2030-01-12",
  );
  await fireEvent.changeText(
    screen.getByLabelText("复盘调整备注"),
    "本周时间较少",
  );
  const button = screen.getByText("确认选择，生成后续训练草稿");
  await fireEvent.press(button);
  await fireEvent.press(button);
  await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1));
  expect(api.generate.mock.calls[0][1]).toMatchObject({
    review: { action: "RECOVERY", fingerprint: review.fingerprint },
    startDate: "2030-01-09",
    endDate: "2030-01-12",
    notes: "本周时间较少",
    expectedBaseVersion: 1,
  });
  await act(async () =>
    complete({
      generationId: jobId,
      status: "QUEUED",
      proposalId: null,
      errorCode: null,
      requestId: null,
    }),
  );
  expect(mockSetParams).toHaveBeenCalledWith({ generationId: jobId });
  expect(training.apply).not.toHaveBeenCalled();
});

it("retains the idempotency key after uncertain submission failure", async () => {
  api.generate.mockRejectedValueOnce(new Error("连接超时，请重试"));
  const screen = await render(<CycleReviewScreen />);
  await waitFor(() => screen.getByText("确认选择，生成后续训练草稿"));
  await fireEvent.press(screen.getByText("确认选择，生成后续训练草稿"));
  await waitFor(() => screen.getByText("连接超时，请重试"));
  await fireEvent.press(screen.getByText("确认选择，生成后续训练草稿"));
  await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(2));
  expect(api.generate.mock.calls[0].slice(1)).toEqual(
    api.generate.mock.calls[1].slice(1),
  );
});

it("restores an existing job without submitting and links its preview", async () => {
  mockParams = { generationId: jobId };
  const screen = await render(<CycleReviewScreen />);
  await waitFor(() => screen.getByText("预览本次训练草稿"));
  expect(training.generation).toHaveBeenCalledWith("token", jobId);
  expect(api.generate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("预览本次训练草稿"));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(tabs)/coach/suggestion",
    params: {
      id,
      kind: "TRAINING",
      source: "cycle-review",
      startDate: review.startDate,
      endDate: review.endDate,
    },
  });
});

it("explains recovery failure and requires an explicit regenerated request", async () => {
  mockParams = { generationId: jobId };
  training.generation.mockResolvedValue({
    generationId: jobId,
    status: "FAILED",
    proposalId: null,
    errorCode: "INSUFFICIENT_RECOVERY",
    requestId: null,
  });
  const screen = await render(<CycleReviewScreen />);
  await waitFor(() => screen.getByText(/候选包含连续高强度训练/));
  expect(api.generate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("按当前选择重新生成草稿"));
  await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1));
  expect(api.generate.mock.calls[0][1].forceRegenerate).toBe(true);
});

it("guides missing information and never generates on return", async () => {
  api.get.mockResolvedValue({
    ...review,
    missingFields: ["ftp", "availability", "goal"],
  });
  const screen = await render(<CycleReviewScreen />);
  await waitFor(() => screen.getByText("补全训练基础资料"));
  await fireEvent.press(screen.getByText("补全训练基础资料"));
  expect(mockPush).toHaveBeenLastCalledWith("/(tabs)/coach/basics");
  await fireEvent.press(screen.getByText("设置可训练时间"));
  expect(mockPush).toHaveBeenLastCalledWith("/(tabs)/coach/schedule");
  await fireEvent.press(screen.getByText("设置训练目标"));
  expect(mockPush).toHaveBeenLastCalledWith("/goals");
  expect(screen.queryByText("确认选择，生成后续训练草稿")).toBeNull();
  expect(api.generate).not.toHaveBeenCalled();
});

it("changes review ranges using reads and recovers from invalid ranges", async () => {
  const screen = await render(<CycleReviewScreen />);
  await waitFor(() => screen.getByText("上一个完整周"));
  await fireEvent.press(screen.getByText("上一个完整周"));
  expect(mockSetParams).toHaveBeenLastCalledWith({
    startDate: "2029-12-31",
    endDate: "2030-01-06",
    generationId: "",
  });
  expect(api.generate).not.toHaveBeenCalled();
  api.get.mockRejectedValueOnce(
    new Error("请选择截至今天的连续 1–84 天复盘范围"),
  );
  mockParams = { startDate: "invalid", endDate: "2030-01-07" };
  await screen.rerender(<CycleReviewScreen />);
  await waitFor(() => screen.getByText("返回最近七天"));
  await fireEvent.press(screen.getByText("返回最近七天"));
  expect(mockSetParams).toHaveBeenLastCalledWith({
    startDate: "",
    endDate: "",
    generationId: "",
  });
});

it("preserves the primary review when history fails and offers retry", async () => {
  api.history.mockRejectedValueOnce(new Error("网络错误"));
  const screen = await render(<CycleReviewScreen />);
  await waitFor(() => screen.getByText("历史读取失败：网络错误"));
  expect(screen.getByText("补充反馈后再判断")).toBeTruthy();
  await fireEvent.press(screen.getByText("重试读取历史"));
  await waitFor(() => expect(api.history).toHaveBeenCalledTimes(2));
  expect(api.generate).not.toHaveBeenCalled();
});

it("previews saved evidence then requires validation and confirmation before applying and entering next cycle", async () => {
  mockParams = {
    id,
    kind: "TRAINING",
    source: "cycle-review",
    startDate: review.startDate,
    endDate: review.endDate,
  };
  const screen = await render(<CoachSuggestionScreen />);
  await waitFor(() => screen.getByText("本草稿的周期复盘依据"));
  expect(training.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("校验这份建议"));
  await waitFor(() => screen.getByText("预览完成，准备应用"));
  await fireEvent.press(screen.getByText("预览完成，准备应用"));
  expect(training.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认应用到正式计划"));
  await waitFor(() => screen.getByText("前往下一周期训练"));
  expect(training.apply).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText("前往下一周期训练"));
  expect(mockReplace).toHaveBeenLastCalledWith({
    pathname: "/(tabs)/training",
    params: { date: "2030-01-08" },
  });
  await fireEvent.press(screen.getByText("返回周期复盘与历史"));
  expect(mockReplace).toHaveBeenLastCalledWith({
    pathname: "/(tabs)/coach/cycle-review",
    params: { startDate: review.startDate, endDate: review.endDate },
  });
});

it("keeps partially typed dates editable without crashing or submitting", async () => {
  const screen = await render(<CycleReviewScreen />);
  await screen.findByLabelText("后续训练开始日期");
  await fireEvent.changeText(
    screen.getByLabelText("后续训练开始日期"),
    "2030-0",
  );
  expect(screen.getByLabelText("后续训练开始日期").props.value).toBe("2030-0");
  expect(screen.getByLabelText("后续训练结束日期").props.value).toBe("");
  await fireEvent.press(screen.getByText("确认选择，生成后续训练草稿"));
  await screen.findByText(/填写有效的后续训练起止日期/);
  expect(api.generate).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("后续训练开始日期"), "");
  expect(screen.getByLabelText("后续训练开始日期").props.value).toBe("");
});

it("restores a historical failed task's review range and chosen direction without generating", async () => {
  api.history.mockResolvedValue({
    items: [
      {
        generationId: jobId,
        proposalId: null,
        createdAt: "2030-01-02T00:00:00Z",
        status: "FAILED",
        errorCode: "AI_OUTPUT_INVALID",
        review: {
          startDate: "2029-12-20",
          endDate: "2029-12-26",
          action: "RECOVERY",
          fingerprint: "b".repeat(64),
        },
        startDate: "2030-01-08",
        endDate: "2030-01-10",
        appliedPlanVersion: null,
        evidence: null,
      },
    ],
  });
  const screen = await render(<CycleReviewScreen />);
  await screen.findByText("查看生成状态");
  await fireEvent.press(screen.getByText("查看生成状态"));
  expect(mockSetParams).toHaveBeenLastCalledWith({
    generationId: jobId,
    startDate: "2029-12-20",
    endDate: "2029-12-26",
  });
  expect(screen.getByText("已选：生成恢复训练")).toBeTruthy();
  expect(screen.getByLabelText("后续训练结束日期").props.value).toBe(
    "2030-01-10",
  );
  expect(api.generate).not.toHaveBeenCalled();
});
