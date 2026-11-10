import { Stack, usePathname } from "expo-router";
import { Text } from "react-native";
import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
} from "expo-router/testing-library";
import { selectPlanningDate } from "../../../../test/select-planning-date";
import { getProfile } from "../../profile/services/profile.api";
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
jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
}));
jest.mock("../../coach/services/coach.api", () => ({
  ...jest.requireActual("../../coach/services/coach.api"),
  coachApi: {
    createGoal: jest.fn(),
    goals: jest.fn(),
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
  "goals/new": () => <GoalManagementScreen mode="create" />,
  "goals/stage-review": StageReviewScreen,
  "goals/course-preview": () => <Text>课程待预览确认</Text>,
  "goals/stage-preview": () => <Text>阶段待预览确认</Text>,
  "goals/[goalId]": function GoalDetailRoute() {
    return <Text>{`目标详情 ${usePathname()}`}</Text>;
  },
  "goals/index": () => <Text>目标列表</Text>,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useAuth)
    .mockReturnValue({ session: { accessToken: "token" } } as ReturnType<
      typeof useAuth
    >);
  jest
    .mocked(getProfile)
    .mockResolvedValue({ timezone: "UTC" } as Awaited<
      ReturnType<typeof getProfile>
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
  coach.goals.mockResolvedValue([goal]);
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
  expect(screen.queryByRole("button", { name: "添加目标" })).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText("目标操作理由"),
    "近期时间不足",
  );
  expect(api.preview).not.toHaveBeenCalled();
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("预览目标修改"));
  await screen.findByText("保留 2099-01-02 · 保留正式课程");
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认保存修改"));
  await screen.findByText("响应中断");
  await fireEvent.press(screen.getByText("确认保存修改"));
  await screen.findByText("目标修改已保存");
  expect(api.apply.mock.calls[0]).toEqual(api.apply.mock.calls[1]);
  expect(planning.generateCourses).not.toHaveBeenCalled();
});

test("stale goal preview preserves form input and requires another preview", async () => {
  api.apply.mockRejectedValueOnce(
    new CoachApiError("目标已变化", 409, "GOAL_PREVIEW_STALE"),
  );
  await renderRouter(routes, { initialUrl: `/goals/manage?goalId=${goalId}` });
  await selectPlanningDate("目标日期", "2099-03-31");
  await fireEvent.changeText(
    screen.getByLabelText("目标操作理由"),
    "延期后再测量",
  );
  await fireEvent.press(screen.getByText("预览目标修改"));
  await fireEvent.press(await screen.findByText("确认保存修改"));
  await screen.findByText("目标已变化");
  expect(screen.getByLabelText("目标日期").props.accessibilityValue.text).toBe(
    "2099年3月31日",
  );
  expect(screen.queryByText("确认保存修改")).toBeNull();
});

test("new custom goals require evaluation and confirmation before saving", async () => {
  await renderRouter(routes, { initialUrl: "/goals/new" });
  await fireEvent.press(await screen.findByText("自定义目标"));
  await selectPlanningDate("目标日期", "2099-03-31");
  expect(screen.queryByLabelText("目标达成条件")).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText("目标说明"),
    "记录同路线用时",
  );
  await fireEvent.press(screen.getByText("预览新目标"));
  await screen.findByText("新目标预览");
  expect(coach.createGoal).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认添加目标"));
  await screen.findByText("新目标已添加");
  expect(coach.createGoal.mock.calls[0][1]).toMatchObject({
    type: "CUSTOM",
    description: "记录同路线用时",
    successCriteria: null,
  });
});

test("adding a separate goal uses a blank form and never changes an existing goal", async () => {
  const added = {
    ...goal,
    id: evidence.id,
    type: "CUSTOM" as const,
    description: "独立的新目标",
    priority: "SECONDARY" as const,
  };
  coach.createGoal.mockResolvedValue(added);
  await renderRouter(routes, { initialUrl: "/goals/new" });
  await screen.findByText("目标条件");
  expect(screen.getByLabelText("目标说明").props.value).toBe("");
  expect(screen.getByLabelText("目标日期").props.accessibilityValue.text).toBe(
    "请选择日期",
  );
  expect(screen.queryByText("本次操作")).toBeNull();
  expect(screen.queryByText("设为主目标")).toBeNull();
  expect(screen.getByText("次目标")).toBeTruthy();
  await fireEvent.press(await screen.findByText("自定义目标"));
  await fireEvent.changeText(screen.getByLabelText("目标说明"), "独立的新目标");
  await selectPlanningDate("目标日期", "2099-03-31");
  await fireEvent.press(screen.getByText("预览新目标"));
  await screen.findByText("新目标预览");
  expect(coach.createGoal).not.toHaveBeenCalled();
  expect(api.preview).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认添加目标"));
  await screen.findByText("新目标已添加");
  expect(coach.createGoal.mock.calls[0][1]).toMatchObject({
    type: "CUSTOM",
    priority: "SECONDARY",
    description: "独立的新目标",
  });
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("查看目标与阶段"));
  await screen.findByText(`目标详情 /goals/${added.id}`);
});

test("new routes ignore goal IDs and the first goal defaults to primary", async () => {
  coach.goals.mockResolvedValue([]);
  await renderRouter(routes, { initialUrl: `/goals/new?goalId=${goalId}` });
  await screen.findByText("目标条件");
  expect(api.overview).not.toHaveBeenCalled();
  expect(screen.queryByText("优先级")).toBeNull();
  expect(screen.getByLabelText("目标说明").props.value).toBe("");
  await selectPlanningDate("目标日期", "2099-03-31");
  await fireEvent.press(screen.getByText("预览新目标"));
  await screen.findByText("新目标预览");
  expect(api.evaluate.mock.calls[0][1].priority).toBe("PRIMARY");
  expect(api.preview).not.toHaveBeenCalled();
});

test("multiple goals switch the primary only after a preview listing the previous primary", async () => {
  const secondary = { ...goal, priority: "SECONDARY" as const };
  const primary = { ...goal, id: evidence.id, description: "原先的主目标" };
  coach.goals.mockResolvedValue([secondary, primary]);
  api.overview.mockResolvedValue({ goal: secondary, evaluation, history: [] });
  api.preview.mockResolvedValue({
    ...comparison,
    before: secondary,
    after: { ...goal, version: 2 },
    affected: { ...comparison.affected, otherPrimaryGoals: [primary] },
  });
  await renderRouter(routes, { initialUrl: `/goals/manage?goalId=${goalId}` });
  await fireEvent.press(await screen.findByText("设为主目标"));
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("目标操作理由"),
    "优先备战本目标",
  );
  await fireEvent.press(screen.getByText("预览目标修改"));
  await screen.findByText("原先的主目标：主目标 → 次目标");
  expect(api.preview.mock.calls[0][2].changes?.priority).toBe("PRIMARY");
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("返回修改"));
  await fireEvent.press(screen.getByText("取消设为主目标"));
  expect(screen.getByText("设为主目标")).toBeTruthy();
});

test("an edit route without a goal ID cannot create or mutate a goal", async () => {
  await renderRouter(routes, { initialUrl: "/goals/manage" });
  await screen.findByText("未指定要编辑的目标，请返回目标列表");
  expect(screen.queryByText("预览新目标")).toBeNull();
  expect(screen.queryByText("预览目标修改")).toBeNull();
  expect(coach.createGoal).not.toHaveBeenCalled();
  expect(api.apply).not.toHaveBeenCalled();
});

test("management date selection commits only on confirmation and survives preview cancellation", async () => {
  await renderRouter(routes, { initialUrl: `/goals/manage?goalId=${goalId}` });
  await fireEvent.changeText(
    await screen.findByLabelText("目标说明"),
    "保留说明",
  );
  await fireEvent.changeText(screen.getByLabelText("目标操作理由"), "调整期限");
  await fireEvent.press(screen.getByRole("button", { name: "目标日期" }));
  expect(screen.queryByRole("radio", { name: "2098年" })).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: "3月" }));
  await fireEvent.press(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByLabelText("目标日期").props.accessibilityValue.text).toBe(
    "2099年2月28日",
  );
  await selectPlanningDate("目标日期", "2099-03-31");
  await fireEvent.press(screen.getByText("预览目标修改"));
  await screen.findByText("目标变更预览");
  expect(api.preview).toHaveBeenCalledWith(
    "token",
    goalId,
    expect.objectContaining({
      changes: expect.objectContaining({
        targetDate: "2099-03-31",
        description: "保留说明",
      }),
    }),
  );
  expect(api.apply).not.toHaveBeenCalled();
  expect(screen.getByText("需另行确认训练变更")).toBeTruthy();
  expect(screen.getByText(evaluation.notices[0])).toBeTruthy();
  await fireEvent.press(screen.getByText("返回修改"));
  expect(screen.getByLabelText("目标日期").props.accessibilityValue.text).toBe(
    "2099年3月31日",
  );
  expect(screen.getByLabelText("目标说明").props.value).toBe("保留说明");
  expect(screen.getByLabelText("目标操作理由").props.value).toBe("调整期限");
});

test("supplementary notices open from info icons without displaying decision history", async () => {
  api.overview.mockResolvedValue({
    goal,
    evaluation,
    history: [
      {
        id: evidence.id,
        action: "UPDATE",
        reason: "历史调整依据",
        createdAt: "2099-01-01T00:00:00Z",
      },
    ],
  });
  await renderRouter(routes, { initialUrl: `/goals/manage?goalId=${goalId}` });
  await screen.findByText("本次操作");
  expect(screen.queryByText(evaluation.notices[0])).toBeNull();
  expect(screen.queryByText("历史调整依据")).toBeNull();
  for (const title of ["评估说明", "目标操作说明", "目标指标说明"]) {
    await fireEvent.press(screen.getByRole("button", { name: `查看${title}` }));
    expect(screen.getByText(title)).toBeTruthy();
    if (title === "评估说明")
      expect(
        screen.getByText(evaluation.notices[0], { exact: false }),
      ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "知道了" }));
  }
  expect(screen.queryByRole("button", { name: "目标决策历史" })).toBeNull();
  expect(screen.queryByText("决策历史")).toBeNull();
  expect(screen.queryByText("历史调整依据")).toBeNull();
  expect(screen.queryByLabelText("目标达成条件")).toBeNull();
  expect(api.preview).not.toHaveBeenCalled();
  expect(api.apply).not.toHaveBeenCalled();
});

test("only completing a goal asks for criteria and evidence, preserving them across editing and conflict retry", async () => {
  const before = { ...goal, successCriteria: null, targetDate: "2098-12-31" };
  const criteria = "同路线完成百公里并记录用时";
  const after = {
    ...before,
    successCriteria: criteria,
    status: "CLOSED" as const,
    closureReason: "COMPLETED" as const,
    version: 3,
  };
  api.overview.mockResolvedValue({ goal: before, evaluation, history: [] });
  api.preview.mockResolvedValue({ ...comparison, before, after });
  api.apply.mockRejectedValueOnce(
    new CoachApiError("目标已变化", 409, "GOAL_PREVIEW_STALE"),
  );
  api.apply.mockResolvedValue({
    mutationId: evidence.id,
    goal: after,
    nextGoal: null,
  });
  await renderRouter(routes, { initialUrl: `/goals/manage?goalId=${goalId}` });
  await screen.findByText("本次操作");
  for (const name of ["调整目标 / 延期", "暂停目标", "结束目标"]) {
    await fireEvent.press(screen.getByRole("radio", { name }));
    expect(screen.queryByLabelText("目标达成条件")).toBeNull();
  }
  await fireEvent.press(screen.getByRole("radio", { name: "确认完成目标" }));
  expect(screen.getByLabelText("目标达成条件").props.value).toBe("");
  expect(screen.queryByLabelText("目标日期")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "查看达成条件说明" }),
  );
  expect(screen.getByText("达成条件说明")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "知道了" }));
  await fireEvent.press(screen.getByText("预览目标修改"));
  await screen.findByText("请填写达成条件");
  expect(api.preview).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("目标达成条件"), criteria);
  await fireEvent.press(screen.getByText("预览目标修改"));
  await screen.findByText("请填写本次选择的理由或达成证据");
  expect(api.preview).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("目标操作理由"),
    "已完成路线，实际用时四小时",
  );
  await fireEvent.press(screen.getByText("预览目标修改"));
  await screen.findByText("目标变更预览");
  expect(api.preview.mock.calls[0][2]).toEqual({
    action: "COMPLETE",
    expectedVersion: 1,
    reason: "已完成路线，实际用时四小时",
    changes: { successCriteria: criteria },
  });
  expect(screen.getByText(criteria)).toBeTruthy();
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("返回修改"));
  expect(screen.getByLabelText("目标达成条件").props.value).toBe(criteria);
  await fireEvent.press(screen.getByRole("radio", { name: "暂停目标" }));
  expect(screen.queryByLabelText("目标达成条件")).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: "确认完成目标" }));
  expect(screen.getByLabelText("目标达成条件").props.value).toBe(criteria);
  api.overview.mockResolvedValue({
    goal: { ...before, version: 2 },
    evaluation,
    history: [],
  });
  await fireEvent.press(screen.getByText("预览目标修改"));
  await fireEvent.press(await screen.findByText("确认保存修改"));
  await screen.findByText("目标已变化");
  await waitFor(() =>
    expect(screen.getByLabelText("目标达成条件").props.value).toBe(criteria),
  );
  expect(screen.getByLabelText("目标操作理由").props.value).toBe(
    "已完成路线，实际用时四小时",
  );
  await fireEvent.press(screen.getByText("预览目标修改"));
  await screen.findByText("目标变更预览");
  expect(api.preview.mock.calls.at(-1)?.[2].expectedVersion).toBe(2);
  await fireEvent.press(screen.getByText("确认保存修改"));
  await screen.findByText("目标修改已保存");
});

test("a failed overview can retry and a closed goal only allows a next goal", async () => {
  api.overview.mockRejectedValueOnce(new Error("目标读取中断"));
  api.overview.mockResolvedValue({
    ...{ goal, evaluation, history: [] },
    goal: { ...goal, status: "CLOSED", closureReason: "COMPLETED" },
  });
  await renderRouter(routes, { initialUrl: `/goals/manage?goalId=${goalId}` });
  await screen.findByText("目标读取中断");
  await fireEvent.press(screen.getByText("重试"));
  await screen.findByRole("radio", { name: "建立下一目标" });
  expect(screen.queryByRole("radio", { name: "暂停目标" })).toBeNull();
  expect(screen.queryByRole("radio", { name: "结束目标" })).toBeNull();
  expect(screen.getByLabelText("目标日期").props.accessibilityValue.text).toBe(
    "请选择日期",
  );
  expect(screen.queryByLabelText("目标达成条件")).toBeNull();
});

test("creating a goal retries profile loading before opening its date picker", async () => {
  jest.mocked(getProfile).mockRejectedValueOnce(new Error("时区资料读取失败"));
  await renderRouter(routes, { initialUrl: "/goals/new" });
  await screen.findByText("时区资料读取失败");
  await fireEvent.press(screen.getByText("重试"));
  await selectPlanningDate("目标日期", "2099-03-31");
  expect(screen.getByLabelText("目标日期").props.accessibilityValue.text).toBe(
    "2099年3月31日",
  );
  expect(coach.createGoal).not.toHaveBeenCalled();
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
