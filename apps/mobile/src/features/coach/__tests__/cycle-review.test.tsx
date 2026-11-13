import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type {
  CycleReviewSnapshot,
  AiProposalResponse,
} from "@ridepilot/contracts";
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
  goal: { id, title: "耐力目标" },
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
  await fireEvent.press(screen.getByText("返回训练历史"));
  expect(mockReplace).toHaveBeenLastCalledWith({
    pathname: "/training-history",
  });
});
