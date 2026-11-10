import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { router, Stack, usePathname } from "expo-router";
import { Text } from "react-native";
import type { Assessment, AssessmentReview } from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { getProfile } from "../../profile/services/profile.api";
import { goalsApi } from "../../goals/services/goals.api";
import { Button } from "../../../components/ui";
import { assessmentsApi } from "../services/assessments.api";
import { AssessmentScheduleScreen } from "../screens/AssessmentScheduleScreen";
import { AssessmentResultScreen } from "../screens/AssessmentResultScreen";
import { AssessmentDetailScreen } from "../screens/AssessmentDetailScreen";
import { selectPlanningDate } from "../../../../test/select-planning-date";
import { GoalDetailScreen } from "../../goals/screens/GoalDetailScreen";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
}));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: {
    goal: jest.fn(),
    ftp: jest.fn(),
    planStatus: jest.fn(),
    generation: jest.fn(),
  },
  CoachApiError: class extends Error {},
}));
jest.mock("../../goals/services/goals.api", () => ({
  goalsApi: { activeStages: jest.fn(), generateCourses: jest.fn() },
}));
jest.mock("../services/assessments.api", () => ({
  assessmentsApi: {
    list: jest.fn(),
    get: jest.fn(),
    review: jest.fn(),
    preview: jest.fn(),
    create: jest.fn(),
    patch: jest.fn(),
    confirmFtp: jest.fn(),
  },
}));
const api = jest.mocked(assessmentsApi);
const coach = jest.mocked(coachApi);
const goalId = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const ftpId = "00000000-0000-4000-8000-000000000003";
const today = new Date().toISOString().slice(0, 10);
const item: Assessment = {
  id,
  goalId,
  stageId: null,
  localDate: today,
  actualDate: null,
  kind: "FTP",
  protocol: "设备 FTP 方案",
  status: "SCHEDULED",
  resultWatts: null,
  durationSeconds: null,
  routeName: null,
  distanceKm: null,
  source: null,
  rpe: null,
  conditions: null,
  notes: null,
  reason: null,
  comparableConditions: false,
  baselineFtpWatts: 250,
  ftpMeasurementId: null,
  version: 1,
};
const completed: Assessment = {
  ...item,
  actualDate: today,
  status: "COMPLETED",
  resultWatts: 265,
  rpe: 8,
  source: "TRAINER",
  version: 2,
};
const review: AssessmentReview = {
  assessment: completed,
  goalTitle: "提升耐力",
  stageTitle: "基础阶段",
  currentFtp: {
    id: ftpId,
    valueWatts: 250,
    measuredAt: "2026-01-01T00:00:00.000Z",
  },
  previous: null,
  comparison: null,
  training: null,
  canUpdateFtp: true,
  messages: ["暂无可比结果，本次作为基线"],
};
const routes = {
  _layout: function Layout() {
    const pathname = usePathname();
    return (
      <>
        <Text testID="pathname">{pathname}</Text>
        <Stack screenOptions={{ headerShown: false }} />
      </>
    );
  },
  "assessments/new": AssessmentScheduleScreen,
  "assessments/result": AssessmentResultScreen,
  "assessments/[assessmentId]": AssessmentDetailScreen,
  "goals/[goalId]": GoalDetailScreen,
  "goals/course-preview": () => <Text>课程草稿预览</Text>,
  "(tabs)/training": () => <Text>训练日历</Text>,
  "cycling-power-zones": function Settings() {
    return (
      <Button
        onPress={() => {
          coach.ftp.mockResolvedValue({
            id: ftpId,
            valueWatts: 250,
            measuredAt: "2026-01-01T00:00:00Z",
            source: "MANUAL",
          });
          router.back();
        }}
      >
        保存 FTP 并返回
      </Button>
    );
  },
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    session: {
      accessToken: "token",
      expiresAt: Date.now() + 60000,
      user: { id: "user", phone: "13812345678", phoneVerified: false },
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
  coach.goal.mockResolvedValue({
    id: goalId,
    type: "ENDURANCE",
    description: "提升耐力",
    targetWkg: null,
    targetDate: "2099-01-14",
    priority: "PRIMARY",
    status: "ACTIVE",
    version: 1,
  });
  coach.ftp.mockResolvedValue({
    id: ftpId,
    valueWatts: 250,
    measuredAt: "2026-01-01T00:00:00Z",
    source: "MANUAL",
  });
  coach.planStatus.mockResolvedValue({ hasActivePlan: false, planVersion: 0 });
  jest.mocked(goalsApi).activeStages.mockResolvedValue(null);
  jest.mocked(goalsApi).generateCourses.mockResolvedValue({
    generationId: id,
    status: "READY",
    proposalId: id,
    errorCode: null,
    requestId: null,
  });
  api.list.mockResolvedValue([]);
  api.get.mockResolvedValue(item);
  api.review.mockResolvedValue(review);
  api.preview.mockResolvedValue({
    token: "preview-1",
    conflicts: [{ id: ftpId, type: "WORKOUT", title: "同日耐力课程" }],
  });
  api.create.mockResolvedValue(item);
  api.patch.mockResolvedValue(completed);
  api.confirmFtp.mockImplementation(async () => {
    const saved = { ...completed, version: 3, ftpMeasurementId: ftpId };
    api.review.mockResolvedValue({
      ...review,
      assessment: saved,
      canUpdateFtp: false,
      currentFtp: { ...review.currentFtp!, valueWatts: 265 },
    });
    return saved;
  });
});

test("goal test heading opens scheduling with the goal and preserves inputs on return", async () => {
  await renderRouter(routes, { initialUrl: `/goals/${goalId}` });
  await fireEvent.changeText(
    await screen.findByLabelText("课程补充要求"),
    "保留低强度训练",
  );
  await screen.findByText("尚未安排阶段测试");
  await fireEvent.press(screen.getByRole("button", { name: "安排目标测试" }));
  await screen.findByLabelText("测试方法 / 协议");
  expect(screen.getByTestId("pathname").props.children).toBe(
    "/assessments/new",
  );
  expect(coach.goal).toHaveBeenCalledWith("token", goalId);
  expect(api.create).not.toHaveBeenCalled();
  await act(async () => router.back());
  await waitFor(() =>
    expect(screen.getByLabelText("课程补充要求").props.value).toBe(
      "保留低强度训练",
    ),
  );
});

test("whole test card opens its record without a separate view button", async () => {
  api.list.mockResolvedValue([item]);
  await renderRouter(routes, { initialUrl: `/goals/${goalId}` });
  await fireEvent.press(
    await screen.findByRole("button", { name: /查看测试：FTP 测试/ }),
  );
  await screen.findByText("阶段复评");
  expect(screen.getByTestId("pathname").props.children).toBe(
    `/assessments/${id}`,
  );
  expect(api.review).toHaveBeenCalledWith("token", id);
  expect(api.create).not.toHaveBeenCalled();
});

test("pending goal tests show loading without a misleading empty state", async () => {
  api.list.mockImplementationOnce(() => new Promise(() => {}));
  await renderRouter(routes, { initialUrl: `/goals/${goalId}` });
  await screen.findByLabelText("正在读取阶段测试");
  expect(screen.queryByText("尚未安排阶段测试")).toBeNull();
});

test("failed goal test load can retry and missing FTP hides scheduling", async () => {
  coach.ftp.mockResolvedValue(null);
  api.list.mockRejectedValueOnce(new Error("读取测试失败"));
  await renderRouter(routes, { initialUrl: `/goals/${goalId}` });
  await screen.findByText("读取测试失败");
  expect(screen.queryByText("尚未安排阶段测试")).toBeNull();
  expect(screen.queryByRole("button", { name: "安排目标测试" })).toBeNull();
  await fireEvent.press(screen.getByText("重试读取测试"));
  await screen.findByText("尚未安排阶段测试");
  expect(screen.queryByText("读取测试失败")).toBeNull();
});

test("schedule requires method, previews conflicts and preserves input/key after failed creation", async () => {
  api.create.mockRejectedValueOnce(new Error("响应中断，请重试"));
  await renderRouter(routes, {
    initialUrl: `/assessments/new?goalId=${goalId}&date=2099-01-01`,
  });
  await fireEvent.press(await screen.findByText("预览测试安排"));
  expect(api.preview).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("测试方法 / 协议"),
    "我的固定测试方案",
  );
  await fireEvent.press(screen.getByText("预览测试安排"));
  await screen.findByText("同日耐力课程");
  expect(api.create).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("保留原安排并确认测试"));
  await screen.findByText("响应中断，请重试");
  expect(screen.getByLabelText("测试方法 / 协议").props.value).toBe(
    "我的固定测试方案",
  );
  await fireEvent.press(screen.getByText("保留原安排并确认测试"));
  await screen.findByText("测试记录已保存");
  expect(api.create.mock.calls[0]).toEqual(api.create.mock.calls[1]);
});

test("settings roundtrip resumes schedule without losing selected kind/date", async () => {
  await renderRouter(routes, {
    initialUrl: `/assessments/new?goalId=${goalId}&date=2099-01-01`,
  });
  await fireEvent.press(await screen.findByText("持续输出"));
  await fireEvent.changeText(
    screen.getByLabelText("测试方法 / 协议"),
    "同设备持续输出",
  );
  coach.ftp.mockResolvedValue(null);
  await act(async () => router.push("/cycling-power-zones"));
  await fireEvent.press(screen.getByText("保存 FTP 并返回"));
  await waitFor(() =>
    expect(screen.getByLabelText("测试方法 / 协议").props.value).toBe(
      "同设备持续输出",
    ),
  );
  expect(screen.getByLabelText("计划日期").props.value).toBe("2099-01-01");
  await fireEvent.press(screen.getByText("预览测试安排"));
  await waitFor(() =>
    expect(api.preview).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ kind: "POWER_DURATION" }),
    ),
  );
});

test("missing FTP points to settings and does not arrange a test", async () => {
  coach.ftp.mockResolvedValue(null);
  await renderRouter(routes, {
    initialUrl: `/assessments/new?goalId=${goalId}`,
  });
  await fireEvent.press(await screen.findByText("设置 FTP"));
  await fireEvent.press(screen.getByText("保存 FTP 并返回"));
  await screen.findByText("预览测试安排");
  expect(api.create).not.toHaveBeenCalled();
});

test("result requires source/RPE, failure retains values and retry does not confirm FTP", async () => {
  api.patch.mockRejectedValueOnce(new Error("保存失败，输入保留"));
  await renderRouter(routes, {
    initialUrl: `/assessments/result?assessmentId=${id}`,
  });
  await fireEvent.changeText(
    await screen.findByLabelText("最终 FTP（W）"),
    "265",
  );
  await fireEvent.press(screen.getByText("保存测试记录"));
  await screen.findByText("请选择结果来源");
  expect(api.patch).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("骑行台"));
  await fireEvent.changeText(
    screen.getByLabelText("主观强度 RPE（1–10）"),
    "8",
  );
  await fireEvent.press(screen.getByText("保存测试记录"));
  await screen.findByText("保存失败，输入保留");
  expect(screen.getByLabelText("最终 FTP（W）").props.value).toBe("265");
  await fireEvent.press(screen.getByText("保存测试记录"));
  await screen.findByText("阶段复评");
  expect(api.patch.mock.calls[0]).toEqual(api.patch.mock.calls[1]);
  expect(api.confirmFtp).not.toHaveBeenCalled();
});

test("postpone requires reason and conflict preview before mutation", async () => {
  await renderRouter(routes, {
    initialUrl: `/assessments/result?assessmentId=${id}`,
  });
  await fireEvent.press(await screen.findByText("改期"));
  await fireEvent.changeText(
    screen.getByLabelText("新的测试日期"),
    "2099-01-02",
  );
  await fireEvent.press(screen.getByText("预览改期安排"));
  await screen.findByText("请填写原因");
  expect(api.preview).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("原因"), "疲劳，需要恢复");
  await fireEvent.press(screen.getByText("预览改期安排"));
  await screen.findByText("改期当天已有安排");
  expect(api.patch).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认改期并保留原安排"));
  await screen.findByText("阶段复评");
  expect(api.patch.mock.calls[0][2]).toMatchObject({
    status: "POSTPONED",
    reason: "疲劳，需要恢复",
    localDate: "2099-01-02",
    previewToken: "preview-1",
  });
});

test("FTP confirmation is explicit, preserves the current evidence on failure and refreshes after success", async () => {
  api.confirmFtp.mockRejectedValueOnce(new Error("更新未确认，请重试"));
  await renderRouter(routes, { initialUrl: `/assessments/${id}` });
  await fireEvent.press(await screen.findByText("确认更新 FTP"));
  expect(api.confirmFtp).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("确认使用测试 FTP"));
  await waitFor(() => expect(api.confirmFtp).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByText("确认使用测试 FTP"));
  await screen.findByText("FTP 已确认保存");
  expect(api.confirmFtp.mock.calls[0]).toEqual(api.confirmFtp.mock.calls[1]);
  await waitFor(() => expect(api.review).toHaveBeenCalledTimes(2));
});

test("review passes stable assessment/version into subsequent course draft without applying anything", async () => {
  api.get.mockResolvedValue(completed);
  await renderRouter(routes, { initialUrl: `/assessments/${id}` });
  await fireEvent.press(await screen.findByText("选择后续阶段 / 课程范围"));
  await selectPlanningDate("开始日期", "2099-01-01");
  await selectPlanningDate("结束日期", "2099-01-14");
  await fireEvent.press(screen.getByText("生成课程草稿"));
  await screen.findByText("课程草稿预览");
  expect(goalsApi.generateCourses).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      scope: "DATES",
      assessmentId: id,
      assessmentVersion: 2,
    }),
    expect.any(String),
  );
});

test("power-duration results expose actual time and never an FTP update action", async () => {
  const power: Assessment = {
    ...completed,
    kind: "POWER_DURATION",
    resultWatts: 300,
    durationSeconds: 1200,
  };
  api.get.mockResolvedValue({ ...item, kind: "POWER_DURATION" });
  api.review.mockResolvedValue({
    ...review,
    assessment: power,
    canUpdateFtp: false,
  });
  api.patch.mockResolvedValue(power);
  await renderRouter(routes, {
    initialUrl: `/assessments/result?assessmentId=${id}`,
  });
  await fireEvent.changeText(
    await screen.findByLabelText("平均功率（W）"),
    "300",
  );
  await fireEvent.changeText(
    screen.getByLabelText("实际持续时间（秒）"),
    "1200",
  );
  await fireEvent.press(screen.getByText("功率计"));
  await fireEvent.changeText(
    screen.getByLabelText("主观强度 RPE（1–10）"),
    "9",
  );
  await fireEvent.press(screen.getByText("保存测试记录"));
  await screen.findByText("平均功率 300 W · 1200 秒");
  expect(screen.queryByText("确认更新 FTP")).toBeNull();
});
