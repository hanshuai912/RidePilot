import { Stack } from "expo-router";
import { Text } from "react-native";
import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
} from "expo-router/testing-library";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi, CoachApiError } from "../../coach/services/coach.api";
import { GoalManagementScreen } from "../screens/GoalManagementScreen";
import { StageReviewScreen } from "../screens/StageReviewScreen";
import { goalLifecycleApi } from "../services/goal-lifecycle.api";
import { goalsApi } from "../services/goals.api";
import {
  comparison,
  goal,
  goalId,
  evaluation,
  snapshot,
  stageId,
  evidence,
} from "./lifecycle-fixtures";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../coach/services/coach.api", () => ({
  ...jest.requireActual("../../coach/services/coach.api"),
  coachApi: {
    createGoal: jest.fn(),
    planStatus: jest.fn(),
    generation: jest.fn(),
  },
}));
jest.mock("../services/goal-lifecycle.api", () => ({
  goalLifecycleApi: {
    overview: jest.fn(),
    evaluate: jest.fn(),
    preview: jest.fn(),
    apply: jest.fn(),
    review: jest.fn(),
    criteria: jest.fn(),
    saveReview: jest.fn(),
  },
}));
jest.mock("../services/goals.api", () => ({
  goalsApi: { generateCourses: jest.fn(), generateStages: jest.fn() },
}));
const api = jest.mocked(goalLifecycleApi);
const coach = jest.mocked(coachApi);
const planning = jest.mocked(goalsApi);
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  "goals/manage": GoalManagementScreen,
  "goals/new": GoalManagementScreen,
  "goals/stage-review": StageReviewScreen,
  "goals/course-preview": () => <Text>课程待预览确认</Text>,
  "goals/stage-preview": () => <Text>阶段待预览确认</Text>,
  "goals/[goalId]": () => <Text>目标详情</Text>,
  "goals/index": () => <Text>目标列表</Text>,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useAuth)
    .mockReturnValue({ session: { accessToken: "token" } } as ReturnType<
      typeof useAuth
    >);
  api.overview.mockResolvedValue({ goal, evaluation, history: [] });
  api.evaluate.mockResolvedValue({ evaluation, warnings: [] });
  api.preview.mockResolvedValue(comparison);
  api.apply.mockResolvedValue({
    mutationId: evidence.id,
    goal: comparison.after,
    nextGoal: null,
  });
  coach.createGoal.mockResolvedValue(goal);
  api.review.mockResolvedValue({ snapshot, history: [] });
  api.criteria.mockResolvedValue({
    snapshot: { ...snapshot, criteriaVersion: 2 },
    history: [],
  });
  api.saveReview.mockImplementation(async (_t, _id, input) => ({
    ...evidence,
    ...input,
  }));
  coach.planStatus.mockResolvedValue({ hasActivePlan: false, planVersion: 0 });
  const job = {
    generationId: goalId,
    status: "READY" as const,
    proposalId: goalId,
    errorCode: null,
    requestId: null,
  };
  planning.generateCourses.mockResolvedValue(job);
  planning.generateStages.mockResolvedValue(job);
});

test("goal changes require preview confirmation and uncertain retries retain the key", async () => {
  api.apply.mockRejectedValueOnce(new Error("响应中断"));
  await renderRouter(routes, { initialUrl: `/goals/manage?goalId=${goalId}` });
  await fireEvent.press(await screen.findByText("暂停目标"));
  await fireEvent.changeText(
    screen.getByLabelText("目标操作理由"),
    "近期时间不足",
  );
  expect(api.preview).not.toHaveBeenCalled();
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("预览目标操作"));
  await screen.findByText("保留 2099-01-02 · 保留正式课程");
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认保存目标操作"));
  await screen.findByText("响应中断");
  await fireEvent.press(screen.getByText("确认保存目标操作"));
  await screen.findByText("目标操作已保存");
  expect(api.apply.mock.calls[0]).toEqual(api.apply.mock.calls[1]);
  expect(planning.generateCourses).not.toHaveBeenCalled();
});

test("stale goal preview preserves form input and requires another preview", async () => {
  api.apply.mockRejectedValueOnce(
    new CoachApiError("目标已变化", 409, "GOAL_PREVIEW_STALE"),
  );
  await renderRouter(routes, { initialUrl: `/goals/manage?goalId=${goalId}` });
  await fireEvent.changeText(
    await screen.findByLabelText("目标日期"),
    "2099-03-31",
  );
  await fireEvent.changeText(
    screen.getByLabelText("目标操作理由"),
    "延期后再测量",
  );
  await fireEvent.press(screen.getByText("预览目标操作"));
  await fireEvent.press(await screen.findByText("确认保存目标操作"));
  await screen.findByText("目标已变化");
  expect(screen.getByLabelText("目标日期").props.value).toBe("2099-03-31");
  expect(screen.queryByText("确认保存目标操作")).toBeNull();
});

test("new custom goals require evaluation and confirmation before saving", async () => {
  await renderRouter(routes, { initialUrl: "/goals/new" });
  await fireEvent.press(await screen.findByText("自定义目标"));
  await fireEvent.changeText(screen.getByLabelText("目标日期"), "2099-03-31");
  await fireEvent.changeText(
    screen.getByLabelText("目标达成条件"),
    "记录同路线用时",
  );
  await fireEvent.press(screen.getByText("预览目标操作"));
  await screen.findByText("新目标预览");
  expect(coach.createGoal).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认保存目标操作"));
  await screen.findByText("目标操作已保存");
  expect(coach.createGoal.mock.calls[0][1]).toMatchObject({
    type: "CUSTOM",
    successCriteria: "记录同路线用时",
  });
});

test("stage review, save and follow-up generation each require an explicit click", async () => {
  api.saveReview.mockImplementation(async (_t, _id, input) => {
    const saved = { ...evidence, ...input };
    api.review.mockResolvedValue({ snapshot, history: [saved] });
    return saved;
  });
  planning.generateCourses.mockRejectedValueOnce(new Error("生成响应中断"));
  await renderRouter(routes, {
    initialUrl: `/goals/stage-review?stageId=${stageId}`,
  });
  await screen.findByText("日期结束不代表达成");
  expect(api.saveReview).not.toHaveBeenCalled();
  expect(planning.generateCourses).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("复评理由与证据"),
    "仍缺可比测量",
  );
  await fireEvent.press(screen.getByText("预览本次复评决定"));
  await screen.findByText("复评决定预览");
  expect(api.saveReview).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认保存复评"));
  await screen.findByText("阶段复评已保存，请主动选择下方后续操作");
  await waitFor(() =>
    expect(screen.getByText("生成后续课程草稿")).toBeEnabled(),
  );
  expect(planning.generateCourses).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("生成后续课程草稿"));
  await screen.findByText("生成响应中断");
  await fireEvent.press(screen.getByText("生成后续课程草稿"));
  await screen.findByText("课程待预览确认");
  expect(planning.generateCourses.mock.calls[0]).toEqual(
    planning.generateCourses.mock.calls[1],
  );
  expect(planning.generateCourses.mock.calls[0][1]).toMatchObject({
    stageReviewId: evidence.id,
    stageId,
    scope: "STAGE",
  });
});

test("edited criteria must be saved first and stale review cannot generate courses", async () => {
  api.review.mockResolvedValue({
    snapshot,
    history: [
      { ...evidence, snapshot: { ...snapshot, fingerprint: "b".repeat(64) } },
    ],
  });
  await renderRouter(routes, {
    initialUrl: `/goals/stage-review?stageId=${stageId}`,
  });
  await fireEvent.changeText(
    await screen.findByLabelText("阶段达成条件"),
    "新的测试条件",
  );
  await fireEvent.changeText(
    screen.getByLabelText("复评理由与证据"),
    "证据说明",
  );
  await fireEvent.press(screen.getByText("预览本次复评决定"));
  await screen.findByText("请先保存修改后的达成条件，再复评");
  expect(screen.getByText("生成后续课程草稿")).toBeDisabled();
  expect(api.saveReview).not.toHaveBeenCalled();
  expect(planning.generateCourses).not.toHaveBeenCalled();
});

test("review save retries preserve the idempotency key and rationale", async () => {
  api.saveReview.mockRejectedValueOnce(new Error("保存响应中断"));
  await renderRouter(routes, {
    initialUrl: `/goals/stage-review?stageId=${stageId}`,
  });
  await fireEvent.changeText(
    await screen.findByLabelText("复评理由与证据"),
    "证据说明",
  );
  await fireEvent.press(screen.getByText("预览本次复评决定"));
  await fireEvent.press(await screen.findByText("确认保存复评"));
  await screen.findByText("保存响应中断");
  await fireEvent.press(screen.getByText("确认保存复评"));
  await screen.findByText("阶段复评已保存，请主动选择下方后续操作");
  expect(api.saveReview.mock.calls[0]).toEqual(api.saveReview.mock.calls[1]);
});

test("EXTEND generates an explicit stage draft and binds the review identity", async () => {
  api.review.mockResolvedValue({
    snapshot,
    history: [{ ...evidence, decision: "EXTEND" }],
  });
  await renderRouter(routes, {
    initialUrl: `/goals/stage-review?stageId=${stageId}`,
  });
  await fireEvent.press(await screen.findByText("生成阶段调整草稿"));
  await screen.findByText("阶段待预览确认");
  expect(planning.generateStages.mock.calls[0][1]).toMatchObject({
    stageReviewId: evidence.id,
    goalId,
  });
  expect(planning.generateCourses).not.toHaveBeenCalled();
});

test("reopening a stage resumes an existing generation without submitting a second task", async () => {
  api.review.mockResolvedValue({
    snapshot,
    history: [evidence],
    followups: [
      {
        generationId: goalId,
        reviewId: evidence.id,
        kind: "COURSES",
        status: "RUNNING",
        proposalId: null,
        errorCode: null,
      },
    ],
  });
  coach.generation.mockResolvedValue({
    generationId: goalId,
    status: "READY",
    proposalId: goalId,
    errorCode: null,
    requestId: null,
  });
  await renderRouter(routes, {
    initialUrl: `/goals/stage-review?stageId=${stageId}`,
  });
  await screen.findByText("继续查询原生成任务");
  expect(coach.generation).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("继续查询原生成任务"));
  await screen.findByText("课程待预览确认");
  expect(coach.generation).toHaveBeenCalledWith("token", goalId);
  expect(planning.generateCourses).not.toHaveBeenCalled();
});

test("keeping an ended stage preserves the review but requires extend or adjust for future courses", async () => {
  const ended = { ...snapshot, localDate: "2099-02-01" };
  api.review.mockResolvedValue({
    snapshot: ended,
    history: [{ ...evidence, snapshot: ended }],
  });
  await renderRouter(routes, {
    initialUrl: `/goals/stage-review?stageId=${stageId}`,
  });
  await screen.findByText(
    "阶段日程已结束，后续可选择延长或调整；进入下一阶段需要仍有效的后续日期。",
  );
  expect(screen.getByText("生成后续课程草稿")).toBeDisabled();
  await fireEvent.press(screen.getByText("生成后续课程草稿"));
  expect(planning.generateCourses).not.toHaveBeenCalled();
});
