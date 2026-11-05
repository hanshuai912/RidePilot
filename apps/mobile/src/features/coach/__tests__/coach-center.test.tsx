import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type {
  AiProposalResponse,
  CoachOverview,
  CoachSuggestion,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { CoachOverviewPanel } from "../components/CoachOverviewPanel";
import { CoachSuggestionsPanel } from "../components/CoachSuggestionsPanel";
import { CoachChatScreen } from "../screens/CoachChatScreen";
import { CoachSuggestionScreen } from "../screens/CoachSuggestionScreen";
import { coachCenterApi } from "../services/coach-center.api";
import { coachApi } from "../services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams = {
  id: "00000000-0000-4000-8000-000000000003",
  kind: "TRAINING",
};
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({
  useAuth: () => ({ session: { accessToken: "token", user: { id: "user" } } }),
}));
jest.mock("../services/coach-center.api", () => ({
  coachCenterApi: {
    overview: jest.fn(),
    suggestions: jest.fn(),
    chat: jest.fn(),
    dismiss: jest.fn(),
  },
}));
jest.mock("../services/coach.api", () => ({
  coachApi: {
    proposal: jest.fn(),
    validate: jest.fn(),
    apply: jest.fn(),
    generate: jest.fn(),
  },
}));
jest.mock("../../nutrition/services/nutrition.api", () => ({
  nutritionApi: {
    proposal: jest.fn(),
    validate: jest.fn(),
    apply: jest.fn(),
    generate: jest.fn(),
  },
}));

const id = mockParams.id;
const api = jest.mocked(coachCenterApi);
const training = jest.mocked(coachApi);
const food = jest.mocked(nutritionApi);
const overview: CoachOverview = {
  localDate: "2030-01-09",
  timezone: "Asia/Shanghai",
  planVersion: 2,
  goal: { id, title: "提升耐力", targetDate: "2030-04-01" },
  stage: {
    id,
    title: "基础阶段",
    purpose: "积累耐力",
    startDate: "2030-01-01",
    endDate: "2030-01-31",
    upcoming: false,
  },
  stageNotice: null,
  status: {
    code: "INSUFFICIENT",
    label: "暂无充分状态依据",
    explanation: "缺少疲劳反馈，不能仅根据 RPE 判断恢复",
    evidence: [
      {
        id,
        date: "2030-01-08",
        kind: "ACTIVITY",
        title: "训练反馈",
        detail: "完成 · RPE 8/10 · 未填疲劳",
      },
    ],
  },
  nextWorkout: { id, date: "2030-01-10", title: "耐力训练", minutes: 60 },
  upcomingWorkouts: [],
  nextAssessment: { id, date: "2030-01-11", title: "FTP 测试", overdue: false },
  versions: [
    {
      id,
      version: 2,
      reason: "赛后恢复调整",
      active: true,
      appliedAt: "2030-01-08T00:00:00Z",
    },
  ],
};
const suggestion: CoachSuggestion = {
  id,
  kind: "TRAINING",
  title: "训练调整建议",
  summary: "恢复训练安排",
  status: "READY",
  version: 3,
  createdAt: "2030-01-08T00:00:00Z",
  goalId: null,
  staleReason: null,
};
const proposal: AiProposalResponse = {
  proposalId: id,
  proposalVersion: 3,
  basePlanVersion: 2,
  status: "READY",
  scene: "PLAN_ADJUST",
  replaceWorkoutIds: [],
  weekStartDate: "2030-01-07",
  summary: "恢复训练安排",
  stageSummary: "恢复阶段",
  assessmentSuggestion: "阶段复评",
  workouts: [
    {
      scheduledDate: "2030-01-10",
      title: "轻松骑行",
      purpose: "恢复",
      segments: [
        {
          type: "work",
          target: { kind: "duration", value: 30, unit: "min" },
          intensity: { kind: "ftp_percent", min: 40, max: 50 },
        },
      ],
    },
  ],
  warnings: [],
  blockers: [],
  skillVersion: "test",
  model: "mock",
};
const nutrition: NutritionProposalResponse = {
  proposalId: id,
  proposalType: "AI_PLAN",
  status: "READY",
  proposalVersion: 3,
  baseNutritionVersion: 2,
  original: null,
  metadata: null,
  validation: { passed: true, warnings: [], blockers: [] },
  draft: { startDate: "2030-01-10", endDate: "2030-01-10", items: [] },
};
beforeEach(() => {
  jest.resetAllMocks();
  mockParams = { id, kind: "TRAINING" };
  api.overview.mockResolvedValue(overview);
  api.suggestions.mockResolvedValue({ pending: [suggestion], recent: [] });
  api.dismiss.mockResolvedValue({ dismissed: true });
  training.proposal.mockResolvedValue(proposal);
  training.validate.mockResolvedValue(proposal);
  training.apply.mockResolvedValue({
    success: true,
    newPlanVersion: 3,
    affectedDates: [],
  });
  food.proposal.mockResolvedValue(nutrition);
  food.validate.mockResolvedValue(nutrition);
  food.apply.mockResolvedValue({
    success: true,
    newNutritionVersion: 3,
    affectedDates: [],
  });
});

it("shows dated factual evidence, real next actions and version history without generating", async () => {
  const screen = await render(<CoachOverviewPanel />);
  await screen.findByText("基础阶段");
  expect(screen.getByText("暂无充分状态依据")).toBeTruthy();
  expect(screen.getByText(/2030-01-08 · 训练反馈/)).toBeTruthy();
  await fireEvent.press(screen.getByText("查看下一训练"));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/workouts/[workoutId]",
    params: { workoutId: id },
  });
  await fireEvent.press(screen.getByText("查看测试 / 录入结果"));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/assessments/[assessmentId]",
    params: { assessmentId: id },
  });
  await fireEvent.press(screen.getByText("最近计划版本"));
  expect(screen.getByText(/赛后恢复调整/)).toBeTruthy();
  expect(training.generate).not.toHaveBeenCalled();
  expect(training.apply).not.toHaveBeenCalled();
});
it("offers retry on overview failure and keeps empty-stage guidance honest", async () => {
  api.overview.mockRejectedValueOnce(new Error("网络断开")).mockResolvedValue({
    ...overview,
    stage: null,
    stageNotice: "尚未确认阶段安排",
  });
  const screen = await render(<CoachOverviewPanel />);
  await screen.findByText("网络断开");
  await fireEvent.press(screen.getByText("重新读取概览"));
  await screen.findByText("阶段待规划");
  expect(screen.getByText("尚未确认阶段安排")).toBeTruthy();
});
it("resumes an existing draft by ID and requires confirmation before dismissing", async () => {
  const screen = await render(<CoachSuggestionsPanel />);
  await screen.findByText("恢复训练安排");
  await fireEvent.press(screen.getByText("继续预览建议"));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(tabs)/coach/suggestion",
    params: { id, kind: "TRAINING" },
  });
  expect(training.generate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("放弃建议"));
  expect(api.dismiss).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("保留建议"));
  expect(api.dismiss).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("放弃建议"));
  await fireEvent.press(screen.getByText("确认放弃建议"));
  await waitFor(() =>
    expect(api.dismiss).toHaveBeenCalledWith("token", id, {
      kind: "TRAINING",
      expectedVersion: 3,
    }),
  );
});
it("displays expired reasons and running tasks and reads again when a task finishes", async () => {
  jest.useFakeTimers();
  api.suggestions
    .mockResolvedValueOnce({
      pending: [{ ...suggestion, kind: "GENERATION", status: "RUNNING" }],
      recent: [],
    })
    .mockResolvedValue({
      pending: [{ ...suggestion, staleReason: "正式训练版本已变化" }],
      recent: [],
    });
  const screen = await render(<CoachSuggestionsPanel />);
  await screen.findByText(/生成中/);
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  await screen.findByText("正式训练版本已变化");
  expect(training.generate).not.toHaveBeenCalled();
  await screen.unmount();
  jest.useRealTimers();
});
it("sends questions only on click, keeps failed input and supports bounded follow-up context", async () => {
  api.chat.mockRejectedValueOnce(new Error("回答超时")).mockResolvedValue({
    answer: "依据近期安排解释训练",
    requestId: "req",
    model: "mock",
    readOnly: true,
  });
  const screen = await render(<CoachChatScreen />);
  expect(api.chat).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("向 AI 教练提问"),
    "为什么安排耐力训练？",
  );
  await fireEvent.press(screen.getByText("发送问题"));
  await screen.findByText("回答超时");
  expect(screen.getByLabelText("向 AI 教练提问").props.value).toBe(
    "为什么安排耐力训练？",
  );
  await fireEvent.press(screen.getByText("重试提问"));
  await screen.findByText("依据近期安排解释训练");
  await fireEvent.changeText(
    screen.getByLabelText("向 AI 教练提问"),
    "明天很累可以怎么调整？",
  );
  await fireEvent.press(screen.getByText("发送问题"));
  await waitFor(() =>
    expect(api.chat).toHaveBeenLastCalledWith("token", {
      message: "明天很累可以怎么调整？",
      history: [
        { role: "user", content: "为什么安排耐力训练？" },
        { role: "assistant", content: "依据近期安排解释训练" },
      ],
    }),
  );
  expect(training.apply).not.toHaveBeenCalled();
  expect(training.generate).not.toHaveBeenCalled();
});
it.each(["TRAINING", "NUTRITION"])(
  "revalidates and explicitly confirms %s before applying the previewed version",
  async (kind) => {
    mockParams.kind = kind;
    const screen = await render(<CoachSuggestionScreen />);
    await screen.findByText("校验这份建议");
    expect(training.apply).not.toHaveBeenCalled();
    expect(food.apply).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("校验这份建议"));
    await screen.findByText("预览完成，准备应用");
    await fireEvent.press(screen.getByText("预览完成，准备应用"));
    expect(training.apply).not.toHaveBeenCalled();
    expect(food.apply).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("确认应用到正式计划"));
    if (kind === "TRAINING")
      await waitFor(() =>
        expect(training.apply).toHaveBeenCalledWith(
          "token",
          id,
          2,
          `coach-apply-${id}-3`,
          3,
        ),
      );
    else
      await waitFor(() =>
        expect(food.apply).toHaveBeenCalledWith("token", id, 2, 3),
      );
    await screen.findByText("建议已应用");
  },
);
it("keeps a conflicting draft available for refresh instead of showing applied", async () => {
  training.apply.mockRejectedValue(new Error("草稿已变化，请重新预览和校验"));
  const screen = await render(<CoachSuggestionScreen />);
  await screen.findByText("校验这份建议");
  await fireEvent.press(screen.getByText("校验这份建议"));
  await screen.findByText("预览完成，准备应用");
  await fireEvent.press(screen.getByText("预览完成，准备应用"));
  await fireEvent.press(screen.getByText("确认应用到正式计划"));
  await screen.findByText("草稿已变化，请重新预览和校验");
  expect(screen.queryByText("建议已应用")).toBeNull();
  expect(screen.getByText("刷新草稿状态")).toBeTruthy();
});

it("shows validation blockers and does not offer application", async () => {
  training.validate.mockResolvedValue({
    ...proposal,
    status: "BLOCKED",
    blockers: ["正式计划版本已变化，请重新生成"],
  });
  const screen = await render(<CoachSuggestionScreen />);
  await screen.findByText("校验这份建议");
  await fireEvent.press(screen.getByText("校验这份建议"));
  await screen.findByText("正式计划版本已变化，请重新生成");
  expect(screen.queryByText("预览完成，准备应用")).toBeNull();
  expect(training.apply).not.toHaveBeenCalled();
});
