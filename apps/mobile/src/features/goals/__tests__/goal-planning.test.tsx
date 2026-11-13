import { Stack, router, usePathname, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
  act,
} from "expo-router/testing-library";
import { Button } from "../../../components/ui";
import { selectPlanningDate } from "../../../../test/select-planning-date";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { getProfile } from "../../profile/services/profile.api";
import { GoalDetailScreen } from "../screens/GoalDetailScreen";
import { GoalsScreen } from "../screens/GoalsScreen";
import { StagePreviewScreen } from "../screens/StagePreviewScreen";
import { CoursePreviewScreen } from "../screens/CoursePreviewScreen";
import { goalsApi } from "../services/goals.api";
import { assessmentsApi } from "../../assessments/services/assessments.api";
import type {
  AiProposalResponse,
  StagePlanResponse,
} from "@ridepilot/contracts";

jest.mock("../../assessments/services/assessments.api", () => ({
  assessmentsApi: { list: jest.fn().mockResolvedValue([]) },
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
}));
jest.mock("../../coach/services/coach.api", () => ({
  ...jest.requireActual("../../coach/services/coach.api"),
  coachApi: {
    goal: jest.fn(),
    goals: jest.fn(),
    ftp: jest.fn(),
    planStatus: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
    validate: jest.fn(),
    apply: jest.fn(),
  },
}));
jest.mock("../services/goals.api", () => ({
  goalsApi: {
    activeStages: jest.fn(),
    stagePlan: jest.fn(),
    generateStages: jest.fn(),
    generateCourses: jest.fn(),
    activateStages: jest.fn(),
  },
}));
const coach = jest.mocked(coachApi);
const api = jest.mocked(goalsApi);
const goalId = "00000000-0000-4000-8000-000000000001";
const planId = "00000000-0000-4000-8000-000000000002";
const stageId = "00000000-0000-4000-8000-000000000003";
const proposalId = "00000000-0000-4000-8000-000000000004";
const start = "2099-01-01";
const end = "2099-01-14";
const goal = {
  id: goalId,
  type: "ENDURANCE" as const,
  description: "提升耐力",
  targetWkg: null,
  targetDate: "2099-12-31",
  priority: "PRIMARY" as const,
  status: "ACTIVE" as const,
  version: 1,
};
const ftp = {
  id: "ftp",
  valueWatts: 250,
  measuredAt: "2026-10-01T00:00:00Z",
  source: "MANUAL" as const,
};
const stagePlan: StagePlanResponse = {
  id: planId,
  goalId,
  goalVersion: 1,
  status: "ACTIVE",
  version: 2,
  startDate: start,
  endDate: end,
  stale: false,
  summary: "耐力阶段安排",
  stages: [
    {
      id: stageId,
      position: 0,
      title: "基础耐力阶段",
      purpose: "积累耐力",
      startDate: start,
      endDate: end,
      assessmentSuggestion: "结束时复评",
    },
  ],
};
const proposal: AiProposalResponse = {
  proposalId,
  status: "READY",
  proposalVersion: 1,
  basePlanVersion: 3,
  scene: "RANGE_PLAN",
  weekStartDate: start,
  endDate: end,
  summary: "跨周耐力训练",
  stageSummary: "耐力",
  assessmentSuggestion: "阶段复评",
  replaceWorkoutIds: ["00000000-0000-4000-8000-000000000005"],
  replacedWorkouts: [
    {
      id: "00000000-0000-4000-8000-000000000005",
      scheduledDate: start,
      title: "原耐力课程",
    },
  ],
  workouts: [
    {
      scheduledDate: start,
      title: "新耐力课程",
      purpose: "耐力",
      segments: [
        {
          type: "work",
          target: { kind: "duration", value: 30, unit: "min" },
          intensity: { kind: "ftp_percent", min: 60, max: 70 },
        },
      ],
    },
  ],
  warnings: [],
  blockers: [],
  skillVersion: "1",
  model: "mock",
};
const readyJob = {
  generationId: "00000000-0000-4000-8000-000000000006",
  status: "READY" as const,
  proposalId,
  errorCode: null,
  requestId: null,
};
const routes = {
  _layout: function Root() {
    const path = usePathname();
    return (
      <>
        <Text testID="path">{path}</Text>
        <Stack screenOptions={{ headerShown: false }} />
      </>
    );
  },
  "goals/index": GoalsScreen,
  "goals/[goalId]": GoalDetailScreen,
  "goals/new": () => <Text>独立添加目标表单</Text>,
  "goals/manage": function EditGoal() {
    const { goalId: id } = useLocalSearchParams<{ goalId: string }>();
    return <Text>{`编辑当前目标表单 ${id}`}</Text>;
  },
  "goals/stage-preview": StagePreviewScreen,
  "goals/course-preview": CoursePreviewScreen,
  "cycling-power-zones": function FtpSettings() {
    return (
      <Button
        onPress={() => {
          coach.ftp.mockResolvedValue(ftp);
          router.back();
        }}
      >
        保存 FTP 并返回
      </Button>
    );
  },
  "(tabs)/training": () => <Text>训练日历已刷新</Text>,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    session: {
      accessToken: "token",
      expiresAt: Date.now() + 60000,
      user: { id: "user-1", phone: "13812345678", phoneVerified: true },
    },
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
  });
  jest
    .mocked(getProfile)
    .mockResolvedValue({ timezone: "UTC" } as Awaited<
      ReturnType<typeof getProfile>
    >);
  coach.goal.mockResolvedValue(goal);
  coach.goals.mockResolvedValue([goal]);
  coach.ftp.mockResolvedValue(ftp);
  coach.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 3 });
  coach.proposal.mockResolvedValue(proposal);
  coach.validate.mockResolvedValue(proposal);
  coach.apply.mockResolvedValue({
    success: true,
    newPlanVersion: 4,
    affectedDates: [start],
  });
  api.activeStages.mockResolvedValue(stagePlan);
  api.stagePlan.mockResolvedValue({
    ...stagePlan,
    status: "DRAFT",
    version: 1,
  });
  api.generateCourses.mockResolvedValue(readyJob);
  api.generateStages.mockResolvedValue({ ...readyJob, proposalId: planId });
  api.activateStages.mockResolvedValue(stagePlan);
});
const detail = () => renderRouter(routes, { initialUrl: `/goals/${goalId}` });

test("missing FTP links directly to settings and resumes the selected goal", async () => {
  coach.ftp.mockResolvedValue(null);
  await detail();
  await fireEvent.press(await screen.findByText("设置 FTP"));
  expect(screen.getByTestId("path").props.children).toBe(
    "/cycling-power-zones",
  );
  await fireEvent.press(screen.getByText("保存 FTP 并返回"));
  await screen.findByText("当前 FTP 250 W");
  expect(screen.queryByText("达成条件待补充")).toBeNull();
  expect(screen.getByTestId("path").props.children).toBe(`/goals/${goalId}`);
  expect(api.generateCourses).not.toHaveBeenCalled();
});

test("date generation preserves input and idempotency key after uncertain submission failure", async () => {
  api.generateCourses.mockRejectedValueOnce(new Error("网络连接中断"));
  await detail();
  await selectPlanningDate("开始日期", start);
  await selectPlanningDate("结束日期", end);
  await fireEvent.changeText(
    screen.getByLabelText("课程补充要求"),
    "减少长距离训练",
  );
  await fireEvent.press(screen.getByText("生成课程草稿"));
  await screen.findByText("网络连接中断");
  expect(screen.getByLabelText("课程补充要求").props.value).toBe(
    "减少长距离训练",
  );
  await fireEvent.press(screen.getByText("生成课程草稿"));
  await screen.findByText("跨周耐力训练");
  expect(api.generateCourses.mock.calls[0]).toEqual(
    api.generateCourses.mock.calls[1],
  );
  expect(api.generateCourses.mock.calls[0][1]).toMatchObject({
    scope: "DATES",
    goalId,
    startDate: start,
    endDate: end,
    expectedBaseVersion: 3,
    notes: "减少长距离训练",
  });
  expect(coach.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("校验课程草稿"));
  await fireEvent.press(await screen.findByText("确认应用课程"));
  await screen.findByText("训练日历已刷新");
});

test("a long date range blocks course generation while allowing stage planning", async () => {
  await detail();
  await selectPlanningDate("开始日期", start);
  await selectPlanningDate("结束日期", "2099-05-01");
  expect(screen.getByText("共 121 天")).toBeTruthy();
  expect(screen.getByRole("button", { name: "生成课程草稿" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "重新规划阶段" }));
  expect(screen.getByRole("button", { name: "生成阶段草稿" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "收起阶段规划" }));
  expect(api.generateCourses).not.toHaveBeenCalled();
  expect(api.generateStages).not.toHaveBeenCalled();
  await selectPlanningDate("结束日期", end);
  expect(screen.getByRole("button", { name: "生成课程草稿" })).toBeEnabled();
});

test("selected-stage generation sends the stage ID and does not send editable date overrides", async () => {
  await detail();
  await fireEvent.press(await screen.findByRole("radio", { name: "所选阶段" }));
  expect(
    screen.getByRole("button", { name: "生成课程草稿" }).props
      .accessibilityState.disabled,
  ).toBe(true);
  await fireEvent.press(
    screen.getByRole("radio", { name: "选择阶段：基础耐力阶段" }),
  );
  expect(
    screen.getByRole("button", { name: "选择训练阶段" }).props
      .accessibilityState.expanded,
  ).toBe(false);
  expect(screen.queryByText("选择此阶段生成课程")).toBeNull();
  expect(api.generateCourses).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("生成课程草稿"));
  await screen.findByText("跨周耐力训练");
  expect(api.generateCourses.mock.calls[0][1]).toMatchObject({
    scope: "STAGE",
    goalId,
    stageId,
    expectedBaseVersion: 3,
  });
  expect(api.generateCourses.mock.calls[0][1]).not.toHaveProperty("startDate");
});

test("stage generation previews a saved draft and retries failed activation without changing its version", async () => {
  api.activateStages.mockRejectedValueOnce(new Error("确认失败，输入保留"));
  await detail();
  await selectPlanningDate("开始日期", start);
  await selectPlanningDate("结束日期", end);
  await fireEvent.press(screen.getByRole("button", { name: "重新规划阶段" }));
  await selectPlanningDate("阶段开始日期", start);
  await selectPlanningDate("阶段结束日期", end);
  await fireEvent.press(screen.getByText("生成阶段草稿"));
  await screen.findByText("阶段草稿 · 尚未确认");
  expect(api.generateStages).toHaveBeenCalledWith(
    "token",
    { goalId, startDate: start, endDate: end, forceRegenerate: true },
    expect.any(String),
  );
  expect(screen.getByText(stagePlan.summary)).toBeTruthy();
  expect(api.activateStages).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认阶段安排"));
  await screen.findByText("确认失败，输入保留");
  await fireEvent.press(screen.getByText("确认阶段安排"));
  await waitFor(() =>
    expect(screen.getByTestId("path").props.children).toBe(`/goals/${goalId}`),
  );
  expect(api.activateStages.mock.calls).toEqual([
    ["token", planId, 1],
    ["token", planId, 1],
  ]);
});

test("stage planning preserves independent dates, course notes and the same request after an uncertain failure", async () => {
  api.generateStages.mockRejectedValueOnce(new Error("阶段生成连接中断"));
  await detail();
  await selectPlanningDate("开始日期", start);
  await selectPlanningDate("结束日期", end);
  await fireEvent.changeText(
    screen.getByLabelText("课程补充要求"),
    "保留课程要求",
  );
  await fireEvent.press(screen.getByRole("button", { name: "重新规划阶段" }));
  await selectPlanningDate("阶段开始日期", "2099-02-01");
  await selectPlanningDate("阶段结束日期", "2099-03-01");
  await fireEvent.press(screen.getByRole("button", { name: "收起阶段规划" }));
  expect(screen.queryByLabelText("阶段开始日期")).toBeNull();
  expect(screen.getByLabelText("开始日期").props.accessibilityValue.text).toBe(
    "2099年1月1日",
  );
  expect(screen.getByLabelText("结束日期").props.accessibilityValue.text).toBe(
    "2099年1月14日",
  );
  expect(screen.getByLabelText("课程补充要求").props.value).toBe(
    "保留课程要求",
  );
  expect(api.generateStages).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "重新规划阶段" }));
  expect(
    screen.getByLabelText("阶段开始日期").props.accessibilityValue.text,
  ).toBe("2099年2月1日");
  await fireEvent.press(screen.getByText("生成阶段草稿"));
  await screen.findByText("阶段生成连接中断");
  await fireEvent.press(screen.getByText("生成阶段草稿"));
  await screen.findByText("阶段草稿 · 尚未确认");
  expect(api.generateStages.mock.calls[0]).toEqual(
    api.generateStages.mock.calls[1],
  );
  expect(api.generateStages.mock.calls[0][1]).toMatchObject({
    startDate: "2099-02-01",
    endDate: "2099-03-01",
    forceRegenerate: true,
  });
  expect(api.activateStages).not.toHaveBeenCalled();
  expect(api.generateCourses).not.toHaveBeenCalled();
});

test("a missing stage plan can be created from its heading without forcing regeneration", async () => {
  api.activeStages.mockResolvedValue(null);
  await detail();
  await fireEvent.press(
    await screen.findByRole("button", { name: "规划阶段" }),
  );
  await selectPlanningDate("阶段开始日期", start);
  await selectPlanningDate("阶段结束日期", end);
  await fireEvent.press(screen.getByText("生成阶段草稿"));
  await screen.findByText("阶段草稿 · 尚未确认");
  expect(api.generateStages.mock.calls[0][1]).toEqual({
    goalId,
    startDate: start,
    endDate: end,
  });
  expect(api.activateStages).not.toHaveBeenCalled();
});

test.each(["missing FTP", "paused goal"])(
  "%s hides the stage planning action",
  async (reason) => {
    if (reason === "missing FTP") coach.ftp.mockResolvedValue(null);
    else {
      coach.goal.mockResolvedValue({ ...goal, status: "PAUSED" });
      coach.goals.mockResolvedValue([{ ...goal, status: "PAUSED" }]);
    }
    await detail();
    await screen.findByText("阶段安排");
    expect(screen.queryByRole("button", { name: "重新规划阶段" })).toBeNull();
    expect(screen.queryByTestId("goal-stage-planner")).toBeNull();
  },
);

test("stage planning explanation opens only from its icon and closes without changing inputs or generating", async () => {
  await detail();
  const info = await screen.findByRole("button", { name: "查看阶段安排说明" });
  expect(screen.getByText("综合训练规划")).toBeTruthy();
  expect(screen.getAllByText("阶段安排")).toHaveLength(1);
  expect(screen.queryByText(/阶段和课程由全部进行中目标共同规划/)).toBeNull();
  expect(screen.queryByText(stagePlan.summary)).toBeNull();
  expect(screen.getByText("基础耐力阶段")).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("课程补充要求"),
    "保留休息日",
  );
  await fireEvent.press(info);
  expect(screen.getByText(/阶段和课程由全部进行中目标共同规划/)).toBeTruthy();
  expect(screen.getByText(stagePlan.summary)).toBeTruthy();
  expect(screen.getByText("阶段安排说明")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "知道了" }));
  expect(screen.queryByText(stagePlan.summary)).toBeNull();
  expect(screen.getByLabelText("课程补充要求").props.value).toBe("保留休息日");
  await fireEvent.press(
    screen.getByRole("button", { name: "查看阶段安排说明" }),
  );
  expect(screen.getByText(stagePlan.summary)).toBeTruthy();
  expect(api.generateStages).not.toHaveBeenCalled();
  expect(api.generateCourses).not.toHaveBeenCalled();
});

test("missing stage plans still explain shared planning without a generated summary", async () => {
  api.activeStages.mockResolvedValue(null);
  await detail();
  await screen.findByText("尚无阶段安排");
  expect(screen.getByText("综合训练规划")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "查看阶段安排说明" }),
  );
  expect(screen.getByText(/阶段和课程由全部进行中目标共同规划/)).toBeTruthy();
  expect(screen.queryByText(stagePlan.summary)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "知道了" }));
  expect(screen.getByText("规划后续训练")).toBeTruthy();
  expect(api.generateStages).not.toHaveBeenCalled();
  expect(api.generateCourses).not.toHaveBeenCalled();
});

test("course application requires validation and confirmation, retains the proposal after failure and retries apply with the same key", async () => {
  coach.apply.mockRejectedValueOnce(new Error("响应丢失"));
  await renderRouter(routes, {
    initialUrl: `/goals/course-preview?proposalId=${proposalId}`,
  });
  await screen.findByText("原耐力课程", { exact: false });
  await fireEvent.press(screen.getByText("校验课程草稿"));
  await screen.findByText("确认应用课程");
  expect(coach.apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认应用课程"));
  await screen.findByText("响应丢失");
  expect(screen.getByText("新耐力课程")).toBeTruthy();
  await fireEvent.press(screen.getByText("确认应用课程"));
  await screen.findByText("训练日历已刷新");
  expect(coach.validate).toHaveBeenCalledTimes(1);
  expect(coach.apply.mock.calls[0]).toEqual(coach.apply.mock.calls[1]);
});

test("returning from FTP settings keeps date choices and notes", async () => {
  await detail();
  await selectPlanningDate("开始日期", start);
  await selectPlanningDate("结束日期", end);
  await fireEvent.changeText(
    screen.getByLabelText("课程补充要求"),
    "保留此输入",
  );
  await act(async () => router.push("/cycling-power-zones"));
  await fireEvent.press(screen.getByText("保存 FTP 并返回"));
  await waitFor(() =>
    expect(screen.getByLabelText("课程补充要求").props.value).toBe(
      "保留此输入",
    ),
  );
  expect(screen.getByLabelText("开始日期").props.accessibilityValue.text).toBe(
    "2099年1月1日",
  );
  expect(screen.getByLabelText("结束日期").props.accessibilityValue.text).toBe(
    "2099年1月14日",
  );
});

test("course planning has one generation action and no duplicate regeneration entry", async () => {
  await detail();
  await selectPlanningDate("开始日期", start);
  await selectPlanningDate("结束日期", end);
  expect(api.generateCourses).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "更多生成选项" })).toBeNull();
  expect(screen.queryByText("阶段规划与重新生成")).toBeNull();
  expect(screen.queryByText("重新生成课程草稿")).toBeNull();
  expect(screen.getAllByRole("button", { name: "生成课程草稿" })).toHaveLength(
    1,
  );
  await fireEvent.press(screen.getByText("生成课程草稿"));
  await screen.findByText("跨周耐力训练");
  expect(api.generateCourses.mock.calls[0][1]).toMatchObject({
    goalId,
    startDate: start,
    endDate: end,
  });
  expect(api.generateCourses.mock.calls[0][1]).not.toHaveProperty(
    "forceRegenerate",
  );
  expect(coach.apply).not.toHaveBeenCalled();
});

test("goals are grouped by current primary, other and historical goals and cards open the selected goal", async () => {
  coach.goals.mockResolvedValue([
    {
      ...goal,
      id: proposalId,
      type: "CUSTOM",
      status: "CLOSED",
      priority: "SECONDARY",
      closureReason: "COMPLETED",
    },
    {
      ...goal,
      id: stageId,
      type: "CLIMBING",
      status: "PAUSED",
      priority: "SECONDARY",
    },
    goal,
  ]);
  await renderRouter(routes, { initialUrl: "/goals" });
  await screen.findByText("当前主目标");
  expect(screen.getByText("其他目标")).toBeTruthy();
  expect(screen.getByText("历史目标")).toBeTruthy();
  expect(screen.queryByText("已完成 · 次目标")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "历史目标" }));
  expect(screen.getByText("已完成 · 次目标")).toBeTruthy();
  expect(
    screen
      .getAllByRole("button", { name: /^查看目标：/ })
      .map((item) => item.props.accessibilityLabel),
  ).toEqual([
    "查看目标：提升耐力",
    "查看目标：提升爬坡",
    "查看目标：自定义目标",
  ]);
  await fireEvent.press(
    screen.getByRole("button", { name: "查看目标：提升耐力" }),
  );
  await screen.findByText("当前 FTP 250 W");
  expect(screen.getByTestId("path").props.children).toBe(`/goals/${goalId}`);
  expect(api.generateCourses).not.toHaveBeenCalled();
});

test("the list and detail expose the add action, while editing keeps the selected goal ID", async () => {
  await renderRouter(routes, { initialUrl: "/goals" });
  await screen.findByText("当前主目标");
  await fireEvent.press(screen.getByRole("button", { name: "添加目标" }));
  await screen.findByText("独立添加目标表单");
  expect(screen.getByTestId("path").props.children).toBe("/goals/new");
});

test("empty lists have one clear add action", async () => {
  coach.goals.mockResolvedValue([]);
  await renderRouter(routes, { initialUrl: "/goals" });
  await screen.findByText("还没有训练目标");
  expect(screen.getAllByRole("button", { name: "添加目标" })).toHaveLength(1);
  await fireEvent.press(screen.getByRole("button", { name: "添加目标" }));
  await screen.findByText("独立添加目标表单");
});

test("detail has independent add and edit entries", async () => {
  await detail();
  await screen.findByText("编辑目标");
  expect(screen.getByRole("button", { name: "添加目标" })).toBeTruthy();
  await fireEvent.press(screen.getByText("编辑目标"));
  await screen.findByText(`编辑当前目标表单 ${goalId}`);
  expect(screen.getByTestId("path").props.children).toBe("/goals/manage");
});

test("switching goal details retains the shared stages and tests without reloading the planning form", async () => {
  const secondary = {
    ...goal,
    id: proposalId,
    type: "CUSTOM" as const,
    description: "完成百公里路线",
    priority: "SECONDARY" as const,
  };
  const paused = {
    ...goal,
    id: planId,
    description: "暂停的爬坡目标",
    status: "PAUSED" as const,
    priority: "SECONDARY" as const,
  };
  coach.goals.mockResolvedValue([paused, secondary, goal]);
  coach.goal.mockImplementation(async (_token, id) =>
    id === secondary.id ? secondary : id === paused.id ? paused : goal,
  );
  api.activeStages.mockResolvedValue({
    ...stagePlan,
    scope: "ALL_GOALS",
    planningGoals: [goal, secondary],
  });
  await detail();
  await fireEvent.press(
    await screen.findByRole("button", { name: "切换查看目标" }),
  );
  const target = await screen.findByRole("radio", {
    name: "切换目标：完成百公里路线",
  });
  expect(
    screen.getByRole("radio", { name: "切换目标：提升耐力" }).props
      .accessibilityState.selected,
  ).toBe(true);
  await fireEvent.press(target);
  await screen.findByText("基础耐力阶段");
  expect(coach.goal).toHaveBeenCalledTimes(1);
  expect(api.activeStages).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("radio", { name: "切换目标：完成百公里路线" }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(screen.getByText("基础耐力阶段")).toBeTruthy();
  // Goal browsing no longer depends on legacy assessment scheduling.
  expect(jest.mocked(assessmentsApi.list)).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("radio", { name: "切换目标：暂停的爬坡目标" }),
  );
  expect(
    screen.getByRole("radio", { name: "切换目标：暂停的爬坡目标" }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(screen.getByText("基础耐力阶段")).toBeTruthy();
  expect(screen.getByText("生成课程草稿")).toBeTruthy();
  expect(api.generateCourses).not.toHaveBeenCalled();
  expect(api.generateStages).not.toHaveBeenCalled();
  expect(coach.apply).not.toHaveBeenCalled();
});

test("a secondary goal entry still generates the unified course draft using the primary anchor", async () => {
  const secondary = {
    ...goal,
    id: proposalId,
    description: "百公里",
    priority: "SECONDARY" as const,
  };
  coach.goals.mockResolvedValue([goal, secondary]);
  coach.goal.mockResolvedValue(secondary);
  await renderRouter(routes, { initialUrl: `/goals/${secondary.id}` });
  await selectPlanningDate("开始日期", start);
  await selectPlanningDate("结束日期", end);
  await fireEvent.press(screen.getByText("生成课程草稿"));
  await screen.findByText("跨周耐力训练");
  expect(api.generateCourses.mock.calls[0][1]).toMatchObject({
    goalId: goal.id,
  });
});

test("switching inspected goals preserves the shared planning inputs and editing opens the inspected goal", async () => {
  const secondary = {
    ...goal,
    id: proposalId,
    description: "另一目标",
    priority: "SECONDARY" as const,
  };
  coach.goals.mockResolvedValue([goal, secondary]);
  coach.goal.mockImplementation(async (_token, id) =>
    id === secondary.id ? secondary : goal,
  );
  await detail();
  await fireEvent.changeText(
    await screen.findByLabelText("课程补充要求"),
    "综合训练保留休息日",
  );
  await fireEvent.press(screen.getByRole("button", { name: "切换查看目标" }));
  await fireEvent.press(
    await screen.findByRole("radio", { name: "切换目标：另一目标" }),
  );
  expect(screen.queryByText("返回将放弃当前生成条件，确认离开？")).toBeNull();
  expect(screen.getByLabelText("课程补充要求").props.value).toBe(
    "综合训练保留休息日",
  );
  expect(screen.getByText("基础耐力阶段")).toBeTruthy();
  expect(api.generateCourses).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("编辑目标"));
  await screen.findByText(`编辑当前目标表单 ${secondary.id}`);
});

test("failure to load other goals can retry without hiding the current goal", async () => {
  coach.goals.mockRejectedValueOnce(new Error("列表暂时不可用"));
  await detail();
  await screen.findByText("其他目标读取失败");
  expect(screen.getByText("当前 FTP 250 W")).toBeTruthy();
  coach.goals.mockResolvedValue([
    goal,
    {
      ...goal,
      id: proposalId,
      description: "重试后可见的次目标",
      priority: "SECONDARY",
    },
  ]);
  await fireEvent.press(screen.getByText("重试读取其他目标"));
  await fireEvent.press(
    await screen.findByRole("button", { name: "切换查看目标" }),
  );
  await screen.findByRole("radio", { name: "切换目标：重试后可见的次目标" });
  expect(screen.queryByText("其他目标读取失败")).toBeNull();
});

test("browsing the timeline does not change course scope and inline selection preserves inputs", async () => {
  api.activeStages.mockResolvedValue({
    ...stagePlan,
    endDate: "2099-01-28",
    stages: [
      ...stagePlan.stages,
      {
        ...stagePlan.stages[0],
        id: planId,
        position: 1,
        title: "强化耐力阶段",
        purpose: "强化持续输出",
        startDate: "2099-01-15",
        endDate: "2099-01-28",
      },
    ],
  });
  await detail();
  await selectPlanningDate("开始日期", start);
  await selectPlanningDate("结束日期", end);
  await fireEvent.changeText(
    screen.getByLabelText("课程补充要求"),
    "保留休息日",
  );
  expect(screen.queryByText("强化持续输出")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "展开阶段：强化耐力阶段" }),
  );
  expect(screen.getByText("强化持续输出")).toBeTruthy();
  expect(screen.queryByText("选择此阶段生成课程")).toBeNull();
  expect(
    screen.getByRole("radio", { name: "日期范围" }).props.accessibilityState
      .selected,
  ).toBe(true);
  await fireEvent.press(screen.getByRole("radio", { name: "所选阶段" }));
  await fireEvent.press(
    screen.getByRole("radio", { name: "选择阶段：强化耐力阶段" }),
  );
  expect(
    screen.getByRole("radio", { name: "所选阶段" }).props.accessibilityState
      .selected,
  ).toBe(true);
  expect(screen.queryByLabelText("开始日期")).toBeNull();
  expect(screen.getByLabelText("课程补充要求").props.value).toBe("保留休息日");
  await fireEvent.press(screen.getByRole("radio", { name: "日期范围" }));
  expect(screen.getByLabelText("开始日期").props.accessibilityValue.text).toBe(
    "2099年1月1日",
  );
  expect(screen.getByLabelText("结束日期").props.accessibilityValue.text).toBe(
    "2099年1月14日",
  );
  expect(api.generateCourses).not.toHaveBeenCalled();
  expect(api.generateStages).not.toHaveBeenCalled();
});

test.each(["stale", "ended"])(
  "%s stages remain visible but cannot be selected to generate courses",
  async (reason) => {
    api.activeStages.mockResolvedValue({
      ...stagePlan,
      stale: reason === "stale",
      stages:
        reason === "ended"
          ? [
              {
                ...stagePlan.stages[0],
                startDate: "2020-01-01",
                endDate: "2020-01-14",
              },
            ]
          : stagePlan.stages,
    });
    await detail();
    await screen.findByText("基础耐力阶段");
    expect(screen.queryByText("选择此阶段生成课程")).toBeNull();
    await fireEvent.press(screen.getByRole("radio", { name: "所选阶段" }));
    expect(
      screen.getByRole("radio", { name: "选择阶段：基础耐力阶段" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "生成课程草稿" }).props
        .accessibilityState.disabled,
    ).toBe(true);
  },
);

test("the inline stage picker changes stages independently of timeline expansion and preserves notes", async () => {
  api.activeStages.mockResolvedValue({
    ...stagePlan,
    endDate: "2099-01-28",
    stages: [
      ...stagePlan.stages,
      {
        ...stagePlan.stages[0],
        id: planId,
        position: 1,
        title: "强化阶段",
        startDate: "2099-01-15",
        endDate: "2099-01-28",
      },
    ],
  });
  await detail();
  await fireEvent.changeText(
    await screen.findByLabelText("课程补充要求"),
    "保留休息日",
  );
  await fireEvent.press(screen.getByRole("radio", { name: "所选阶段" }));
  await fireEvent.press(
    screen.getByRole("radio", { name: "选择阶段：强化阶段" }),
  );
  expect(
    screen.getByRole("button", { name: "展开阶段：强化阶段" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "选择训练阶段" }).props
      .accessibilityState.expanded,
  ).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: "选择训练阶段" }));
  await fireEvent.press(
    screen.getByRole("radio", { name: "选择阶段：基础耐力阶段" }),
  );
  expect(
    screen.getByRole("button", { name: "收起阶段：基础耐力阶段" }),
  ).toBeTruthy();
  expect(screen.getByLabelText("课程补充要求").props.value).toBe("保留休息日");
  expect(api.generateCourses).not.toHaveBeenCalled();
});
