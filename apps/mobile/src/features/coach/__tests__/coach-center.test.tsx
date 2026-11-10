import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type {
  AiProposalResponse,
  CoachOverview,
  CoachSuggestion,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { CoachOverviewPanel } from "../components/CoachOverviewPanel";
import { CoachStatusScreen } from "../screens/CoachStatusScreen";
import { CoachMoreActions } from "../components/CoachMoreActions";
import { CoachChatEntry } from "../components/CoachChatEntry";
import { trainingApi } from "../../training/services/training.api";
import { CoachHome } from "../components/CoachHome";
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
jest.mock("../../training/services/training.api", () => ({
  trainingApi: { getWorkout: jest.fn() },
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
  jest.mocked(trainingApi.getWorkout).mockResolvedValue({
    id,
    planVersion: 2,
    sportType: "cycling",
    source: "ai",
    title: "耐力训练",
    purpose: "基础耐力",
    scheduledDate: "2030-01-10",
    dayOrder: 1,
    timeTargetMinutes: 60,
    distanceTargetKm: null,
    segments: proposal.workouts[0].segments,
  });
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

it("shows a concise status and published workout, with detailed evidence on a secondary page", async () => {
  const screen = await render(<CoachOverviewPanel />);
  await screen.findByText("基础阶段");
  expect(screen.getByText("恢复状态待评估")).toBeTruthy();
  expect(screen.queryByText(/2030-01-08 · 训练反馈/)).toBeNull();
  expect(screen.queryByText("完成 · RPE 8/10 · 未填疲劳")).toBeNull();
  await screen.findByText("公路骑行 · 40–50 %FTP");
  await fireEvent.press(screen.getByRole("button", { name: "查看训练详情" }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/workouts/[workoutId]",
    params: { workoutId: id },
  });
  await fireEvent.press(screen.getByRole("button", { name: "查看状态依据" }));
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/coach/status");
  await screen.unmount();
  const details = await render(<CoachStatusScreen />);
  await details.findByText("完成 · RPE 8/10 · 未填疲劳");
  expect(
    details.getByText("缺少疲劳反馈，不能仅根据 RPE 判断恢复"),
  ).toBeTruthy();
  await fireEvent.press(details.getByText("查看测试 / 录入结果"));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/assessments/[assessmentId]",
    params: { assessmentId: id },
  });
  expect(details.getByText(/赛后恢复调整/)).toBeTruthy();
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

it("keeps tasks and existing suggestions available when the overview fails", async () => {
  api.overview.mockRejectedValue(new Error("概览网络错误"));
  const onTask = jest.fn();
  const screen = await render(
    <CoachOverviewPanel>
      <CoachHome
        ready
        missingData=""
        onTask={onTask}
        onFeedback={jest.fn()}
        onCurrentWeek={jest.fn()}
        onCompleteProfile={jest.fn()}
      />
      <CoachSuggestionsPanel compact />
    </CoachOverviewPanel>,
  );
  await screen.findByText("概览网络错误");
  await screen.findByText("恢复训练安排");
  await fireEvent.press(screen.getByRole("button", { name: "重新规划" }));
  expect(onTask).toHaveBeenCalledWith("REPLAN");
  expect(training.generate).not.toHaveBeenCalled();
  expect(training.apply).not.toHaveBeenCalled();
});

it("uses four core tasks and keeps lower frequency actions in the collapsed menu", async () => {
  const actions = {
    onTask: jest.fn(),
    onFeedback: jest.fn(),
    onCurrentWeek: jest.fn(),
    onCompleteProfile: jest.fn(),
  };
  const screen = await render(
    <CoachHome ready={false} missingData="训练目标" {...actions} />,
  );
  for (const name of [
    "重新规划",
    "比赛安排",
    "训练反馈",
    "调整本周",
    "补全训练资料",
  ])
    await fireEvent.press(screen.getByRole("button", { name }));
  expect(actions.onTask.mock.calls).toEqual([["REPLAN"], ["RACE"]]);
  expect(actions.onFeedback).toHaveBeenCalledTimes(1);
  expect(actions.onCurrentWeek).toHaveBeenCalledTimes(1);
  expect(actions.onCompleteProfile).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("赛后恢复")).toBeNull();
  await screen.rerender(
    <CoachHome ready={false} missingData="训练目标" busy {...actions} />,
  );
  for (const button of screen.getAllByRole("button"))
    expect(button.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByRole("button", { name: "重新规划" }));
  expect(actions.onTask).toHaveBeenCalledTimes(2);
  await screen.unmount();
  const recovery = jest.fn();
  const next = jest.fn();
  const menu = await render(
    <CoachMoreActions busy={false} onRecovery={recovery} onNextWeek={next} />,
  );
  expect(menu.queryByText("赛后恢复")).toBeNull();
  await fireEvent.press(menu.getByRole("button", { name: "更多操作" }));
  await fireEvent.press(menu.getByText("赛后恢复"));
  await fireEvent.press(menu.getByText("规划下周"));
  expect(recovery).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledTimes(1);
  for (const [name, route] of [
    ["训练执行与周期复盘", "/(tabs)/coach/cycle-review"],
    ["目标阶段与按范围生成课程", "/goals"],
    ["赛事管理与新增比赛", "/races"],
    ["阶段测试与状态依据", "/(tabs)/coach/status"],
    ["最近计划版本", "/(tabs)/coach/status"],
    ["全部建议与历史", "/(tabs)/coach/suggestions"],
  ]) {
    await fireEvent.press(menu.getByText(name));
    expect(mockPush).toHaveBeenLastCalledWith(route);
  }
});

it("shows only the most actionable suggestion and hides the module when none exist", async () => {
  api.suggestions.mockResolvedValue({
    pending: [
      {
        ...suggestion,
        id: "recent",
        title: "最新普通草稿",
        createdAt: "2030-01-09T00:00:00Z",
      },
      { ...suggestion, status: "BLOCKED", title: "需处理的草稿" },
    ],
    recent: [],
  });
  const screen = await render(<CoachSuggestionsPanel compact />);
  await screen.findByText("需处理的草稿");
  expect(screen.queryByText("最新普通草稿")).toBeNull();
  expect(screen.getAllByText(/草稿未应用/)).toHaveLength(1);
  await fireEvent.press(screen.getByRole("button", { name: "继续预览建议" }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(tabs)/coach/suggestion",
    params: { id, kind: "TRAINING" },
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "查看全部建议与历史" }),
  );
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/coach/suggestions");
  await screen.unmount();
  api.suggestions.mockResolvedValue({ pending: [], recent: [suggestion] });
  const empty = await render(<CoachSuggestionsPanel compact />);
  await waitFor(() => expect(api.suggestions).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(empty.queryByLabelText("正在读取待处理建议")).toBeNull(),
  );
  expect(empty.queryByTestId("coach-pending-suggestions")).toBeNull();
  expect(empty.queryByText("暂无待处理建议")).toBeNull();
  expect(training.generate).not.toHaveBeenCalled();
});

it("keeps a single chat entry that only navigates to the existing chat", async () => {
  const screen = await render(<CoachChatEntry />);
  await fireEvent.press(screen.getByRole("button", { name: "问 AI 教练" }));
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/coach/chat");
  expect(api.chat).not.toHaveBeenCalled();
});

it("does not treat missing training or stale stages as a new valid plan", async () => {
  api.overview.mockResolvedValue({
    ...overview,
    stage: null,
    stageNotice: "目标、FTP 或训练资料已变化，请检查阶段安排",
  });
  const screen = await render(<CoachOverviewPanel />);
  await screen.findByText("阶段待规划");
  expect(
    screen.getByText("阶段待核对；课程仍为已发布的正式安排。"),
  ).toBeTruthy();
  expect(screen.getByText("正式计划 v2 · 已生效")).toBeTruthy();
  await screen.unmount();
  api.overview.mockResolvedValue({ ...overview, nextWorkout: null });
  const empty = await render(<CoachOverviewPanel />);
  await empty.findByText("暂无待执行训练");
  expect(empty.queryByText("查看训练详情")).toBeNull();
});

it("keeps the published summary if workout enrichment fails and avoids mixing plan versions", async () => {
  jest
    .mocked(trainingApi.getWorkout)
    .mockRejectedValueOnce(new Error("详情网络错误"));
  const screen = await render(<CoachOverviewPanel />);
  await screen.findByText("强度详情暂不可用");
  expect(screen.getByText("耐力训练")).toBeTruthy();
  const oldWorkout = {
    id,
    planVersion: 3,
    sportType: "cycling" as const,
    source: "ai" as const,
    title: "新版课程",
    purpose: null,
    scheduledDate: "2030-01-10",
    dayOrder: 1,
    timeTargetMinutes: 90,
    distanceTargetKm: null,
    segments: [],
  };
  jest.mocked(trainingApi.getWorkout).mockResolvedValue(oldWorkout);
  await fireEvent.press(screen.getByText("重试详情"));
  await screen.findByText("训练版本已变化，请查看最新训练日历。");
  expect(screen.queryByText("90")).toBeNull();
  await fireEvent.press(screen.getByText("查看训练日历"));
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/training");
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

it("shows stale drafts only in history with their reasons and excludes them from the count", async () => {
  api.suggestions.mockResolvedValue({
    pending: [],
    recent: [
      {
        ...suggestion,
        status: "SUPERSEDED",
        staleReason: "已有同一任务的新草稿，本草稿已被替代",
      },
    ],
  });
  const screen = await render(<CoachSuggestionsPanel />);
  await screen.findByText("待处理建议 · 0");
  expect(screen.getByText(/已被新草稿替代/)).toBeTruthy();
  expect(screen.getByText("已有同一任务的新草稿，本草稿已被替代")).toBeTruthy();
  expect(screen.queryByText("继续预览建议")).toBeNull();
  expect(training.generate).not.toHaveBeenCalled();
});

it("disables validation and application when the list marks an old READY draft stale", async () => {
  api.suggestions.mockResolvedValue({
    pending: [],
    recent: [
      {
        ...suggestion,
        status: "EXPIRED",
        staleReason: "正式训练版本已变化，请重新生成",
      },
    ],
  });
  const screen = await render(<CoachSuggestionScreen />);
  await screen.findByText("正式训练版本已变化，请重新生成");
  expect(screen.queryByText("校验这份建议")).toBeNull();
  expect(training.validate).not.toHaveBeenCalled();
  expect(training.apply).not.toHaveBeenCalled();
  expect(training.generate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("前往 AI 教练"));
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/coach");
  expect(training.generate).not.toHaveBeenCalled();
});

it("refreshes related stale suggestions after explicit application", async () => {
  api.suggestions
    .mockResolvedValueOnce({ pending: [suggestion], recent: [] })
    .mockResolvedValue({
      pending: [],
      recent: [
        {
          ...suggestion,
          id: "00000000-0000-4000-8000-000000000008",
          status: "EXPIRED",
          staleReason: "关联训练版本已变化",
        },
      ],
    });
  const screen = await render(<CoachSuggestionScreen />);
  await screen.findByText("校验这份建议");
  await fireEvent.press(screen.getByText("校验这份建议"));
  await screen.findByText("预览完成，准备应用");
  await fireEvent.press(screen.getByText("预览完成，准备应用"));
  await fireEvent.press(screen.getByText("确认应用到正式计划"));
  await screen.findByText("已有 1 份关联建议失效，可在建议历史查看原因。");
  expect(api.suggestions).toHaveBeenCalledTimes(2);
  expect(screen.getByText("建议已应用")).toBeTruthy();
});

it("preserves application success if refreshing related suggestions fails", async () => {
  api.suggestions
    .mockResolvedValueOnce({ pending: [suggestion], recent: [] })
    .mockRejectedValue(new Error("读取失败"));
  const screen = await render(<CoachSuggestionScreen />);
  await screen.findByText("校验这份建议");
  await fireEvent.press(screen.getByText("校验这份建议"));
  await screen.findByText("预览完成，准备应用");
  await fireEvent.press(screen.getByText("预览完成，准备应用"));
  await fireEvent.press(screen.getByText("确认应用到正式计划"));
  await screen.findByText("建议已应用");
  await waitFor(() => expect(api.suggestions).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("读取失败")).toBeNull();
});
