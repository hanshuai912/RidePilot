import { Stack, router, usePathname } from "expo-router";
import { Text } from "react-native";
import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
  act,
} from "expo-router/testing-library";
import { Button } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { getProfile } from "../../profile/services/profile.api";
import { GoalDetailScreen } from "../screens/GoalDetailScreen";
import { GoalsScreen } from "../screens/GoalsScreen";
import { StagePreviewScreen } from "../screens/StagePreviewScreen";
import { CoursePreviewScreen } from "../screens/CoursePreviewScreen";
import { goalsApi } from "../services/goals.api";
import type {
  AiProposalResponse,
  StagePlanResponse,
} from "@ridepilot/contracts";

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
  expect(screen.getByTestId("path").props.children).toBe(`/goals/${goalId}`);
  expect(api.generateCourses).not.toHaveBeenCalled();
});

test("date generation preserves input and idempotency key after uncertain submission failure", async () => {
  api.generateCourses.mockRejectedValueOnce(new Error("网络连接中断"));
  await detail();
  await fireEvent.changeText(await screen.findByLabelText("开始日期"), start);
  await fireEvent.changeText(screen.getByLabelText("结束日期"), end);
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

test("selected-stage generation sends the stage ID and does not send editable date overrides", async () => {
  await detail();
  await fireEvent.press(await screen.findByText("选择此阶段生成课程"));
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
  await fireEvent.changeText(await screen.findByLabelText("开始日期"), start);
  await fireEvent.changeText(screen.getByLabelText("结束日期"), end);
  await fireEvent.press(screen.getByText("重新生成阶段草稿"));
  await screen.findByText("阶段草稿 · 尚未确认");
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
  await fireEvent.changeText(await screen.findByLabelText("开始日期"), start);
  await fireEvent.changeText(screen.getByLabelText("结束日期"), end);
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
  expect(screen.getByLabelText("开始日期").props.value).toBe(start);
  expect(screen.getByLabelText("结束日期").props.value).toBe(end);
});
