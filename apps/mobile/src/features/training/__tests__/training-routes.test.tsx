import { Text } from "react-native";
import { within } from "@testing-library/react-native";
import { Stack, router, usePathname } from "expo-router";
import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
  act,
} from "expo-router/testing-library";
import type {
  AiProposalResponse,
  ProposalResponse,
} from "@ridepilot/contracts";
import TabsLayout from "../../../../app/(tabs)/_layout";
import WorkoutLayout from "../../../../app/workouts/_layout";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { trainingApi } from "../services/training.api";
import { HomeScreen } from "../../home/screens/HomeScreen";
import { homeApi } from "../../home/services/home.api";
import { TrainingScreen } from "../screens/TrainingScreen";
import { NewWorkoutScreen } from "../screens/NewWorkoutScreen";
import { WorkoutAdjustmentScreen } from "../screens/WorkoutAdjustmentScreen";
import { WorkoutFeedbackScreen } from "../screens/WorkoutFeedbackScreen";
import { WorkoutAdjustmentPreviewScreen } from "../screens/WorkoutAdjustmentPreviewScreen";
import { WorkoutDetailScreen } from "../screens/WorkoutDetailScreen";
import { WorkoutEditorScreen } from "../screens/WorkoutEditorScreen";
import { WorkoutPreviewScreen } from "../screens/WorkoutPreviewScreen";
import { WorkoutSegmentScreen } from "../screens/WorkoutSegmentScreen";
import { addDays, iso } from "../model/training";

jest.mock("../../home/services/home.api", () => ({
  homeApi: { today: jest.fn() },
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: {
    goals: jest.fn(),
    ftp: jest.fn(),
    adjustWorkout: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
    validate: jest.fn(),
    apply: jest.fn(),
    recordActivity: jest.fn(),
  },
}));
jest.mock("../services/training.api", () => ({
  ...jest.requireActual("../services/training.api"),
  trainingApi: {
    getCalendar: jest.fn(),
    getWorkout: jest.fn(),
    getProposal: jest.fn(),
    createManual: jest.fn(),
    createEdit: jest.fn(),
    updateProposal: jest.fn(),
    validate: jest.fn(),
    apply: jest.fn(),
  },
}));
const api = jest.mocked(trainingApi);
const coach = jest.mocked(coachApi);
const today = iso(new Date());
const workout = {
  id: "00000000-0000-4000-8000-000000000001",
  planVersion: 1,
  sportType: "cycling" as const,
  source: "manual" as const,
  title: "耐力骑行",
  purpose: "基础训练",
  scheduledDate: today,
  dayOrder: 1,
  timeTargetMinutes: 30,
  distanceTargetKm: null,
  segments: [
    {
      type: "work" as const,
      target: { kind: "duration" as const, value: 30, unit: "min" as const },
      intensity: { kind: "power_watt" as const, min: 100, max: 150 },
    },
  ],
};
const proposal: ProposalResponse = {
  proposalId: "00000000-0000-4000-8000-000000000002",
  proposalType: "MANUAL_WORKOUT_CREATE",
  status: "DRAFT",
  basePlanVersion: 0,
  proposalVersion: 1,
  originalWorkout: null,
  draftWorkout: workout,
  validation: { passed: null, warnings: [], blockers: [] },
};
const aiProposal: AiProposalResponse = {
  proposalId: "00000000-0000-4000-8000-000000000003",
  status: "READY",
  proposalVersion: 1,
  basePlanVersion: 1,
  scene: "WORKOUT_ADJUST",
  replaceWorkoutIds: [workout.id],
  weekStartDate: today,
  summary: "今天缩短课程并保留耐力训练目的",
  stageSummary: "保持当前训练阶段",
  assessmentSuggestion: "按原计划复评",
  workouts: [
    {
      scheduledDate: today,
      title: "短时耐力骑行",
      purpose: "保持有氧刺激",
      segments: workout.segments,
    },
  ],
  warnings: [],
  blockers: [],
  skillVersion: "1.1.0",
  model: "test-model",
};
const routes = {
  _layout: function TestRoot() {
    const pathname = usePathname();
    return (
      <>
        <Text testID="current-path">{pathname}</Text>
        <Stack screenOptions={{ headerShown: false }} />
      </>
    );
  },
  "(tabs)/index": HomeScreen,
  "(tabs)/nutrition": () => null,
  "(tabs)/coach": () => null,
  "(tabs)/profile": () => null,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/training": TrainingScreen,
  "workouts/_layout": WorkoutLayout,
  "workouts/new": NewWorkoutScreen,
  "workouts/adjust": WorkoutAdjustmentScreen,
  "workouts/feedback": WorkoutFeedbackScreen,
  "workouts/adjustment-preview": WorkoutAdjustmentPreviewScreen,
  "workouts/editor": WorkoutEditorScreen,
  "workouts/segment": WorkoutSegmentScreen,
  "workouts/preview": WorkoutPreviewScreen,
  "workouts/[workoutId]": WorkoutDetailScreen,
  "cycling-power-zones": function FtpSettings() {
    return (
      <Text
        onPress={() => {
          coach.ftp.mockResolvedValue({
            id: "ftp-1",
            valueWatts: 250,
            measuredAt: new Date().toISOString(),
            source: "MANUAL",
          });
          router.back();
        }}
      >
        保存 FTP 并返回
      </Text>
    );
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    session: {
      user: { id: "user-1", phone: "13812345678", phoneVerified: false },
      accessToken: "token",
      expiresAt: Date.now() + 60000,
    },
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
  });
  coach.ftp.mockResolvedValue({
    id: "ftp-1",
    valueWatts: 250,
    measuredAt: new Date().toISOString(),
    source: "MANUAL",
  });
  api.getCalendar.mockImplementation(async (_token, from, to) => ({
    from,
    to,
    ftpAvailable: false,
    items: [workout],
  }));
  jest.mocked(homeApi.today).mockResolvedValue({
    localDate: today,
    profile: {
      userId: "user-1",
      displayName: "小明",
      timezone: "Asia/Shanghai",
    },
    training: {
      status: "READY",
      data: {
        plan: { hasActivePlan: true, planVersion: 1 },
        calendar: {
          from: today,
          to: today,
          ftpAvailable: true,
          items: [workout],
        },
        nextWorkout: workout,
      },
    },
    nutrition: {
      status: "UNAVAILABLE",
      error: { code: "UNAVAILABLE", message: "暂无饮食数据" },
    },
  });
  api.getWorkout.mockResolvedValue(workout);
  api.getProposal.mockResolvedValue(proposal);
  api.createManual.mockResolvedValue(proposal);
  api.createEdit.mockResolvedValue({
    ...proposal,
    proposalType: "MANUAL_WORKOUT_EDIT",
    originalWorkout: workout,
    basePlanVersion: 1,
  });
  api.updateProposal.mockResolvedValue({ ...proposal, proposalVersion: 2 });
  api.validate.mockResolvedValue({
    ...proposal,
    status: "READY",
    validation: { passed: true, warnings: [], blockers: [] },
  });
  api.apply.mockResolvedValue({
    success: true,
    newPlanVersion: 1,
    affectedDates: [today],
  });
  coach.goals.mockResolvedValue([
    {
      id: "00000000-0000-4000-8000-000000000004",
      type: "ENDURANCE",
      description: null,
      targetWkg: null,
      targetDate: addDays(today, 56),
      priority: "PRIMARY",
      status: "ACTIVE",
      version: 1,
    },
  ]);
  coach.adjustWorkout.mockResolvedValue({
    generationId: "00000000-0000-4000-8000-000000000005",
    status: "READY",
    proposalId: aiProposal.proposalId,
    errorCode: null,
    requestId: "request-1",
  });
  coach.proposal.mockResolvedValue(aiProposal);
  coach.validate.mockResolvedValue(aiProposal);
  coach.apply.mockResolvedValue({
    success: true,
    newPlanVersion: 2,
    affectedDates: [today],
  });
  coach.recordActivity.mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000006",
    workoutId: workout.id,
    localDate: today,
    status: "PARTIAL",
    durationMin: 20,
    rpe: 7,
    fatigue: 6,
    notes: "最后一组没有完成",
  });
});

test("manual creation without FTP resumes the selected date after setting FTP", async () => {
  coach.ftp.mockResolvedValue(null);
  const selected = addDays(today, 5);
  await renderRouter(routes, { initialUrl: `/workouts/new?date=${selected}` });
  await fireEvent.press(await screen.findByText("设置 FTP"));
  expect(api.createManual).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("保存 FTP 并返回"));
  expect((await screen.findByPlaceholderText("YYYY-MM-DD")).props.value).toBe(
    selected,
  );
});

test("manual editing without FTP keeps the existing local course while visiting settings", async () => {
  coach.ftp.mockResolvedValue(null);
  await renderRouter(routes, {
    initialUrl: `/workouts/editor?workoutId=${workout.id}`,
  });
  await fireEvent.press(await screen.findByText("设置 FTP"));
  expect(api.createEdit).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("保存 FTP 并返回"));
  expect(
    (await screen.findByPlaceholderText("例如：爬坡专项")).props.value,
  ).toBe("耐力骑行");
  expect(screen.getByText("训练动作 · 1 个")).toBeTruthy();
});

async function open(url = "/training") {
  await renderRouter(routes, { initialUrl: url });
}
async function back() {
  await act(async () => {
    router.back();
  });
}

test("calendar opens the applied AI workout date and identifies its source", async () => {
  const appliedDate = addDays(today, 7);
  api.getCalendar.mockImplementation(async (_token, from, to) => ({
    from,
    to,
    ftpAvailable: true,
    items:
      from <= appliedDate && to >= appliedDate
        ? [{ ...workout, source: "ai", scheduledDate: appliedDate }]
        : [],
  }));
  await open(`/training?date=${appliedDate}`);
  await waitFor(() => expect(screen.getByText("AI 教练 · 正式")).toBeTruthy());
  expect(api.getCalendar).toHaveBeenCalledWith(
    "token",
    expect.any(String),
    expect.any(String),
  );
  const [from, to] = api.getCalendar.mock.lastCall!.slice(1);
  expect(from! <= appliedDate && to! >= appliedDate).toBe(true);
});

test("changing calendar week also moves the selected date", async () => {
  const futureDate = addDays(today, 7);
  api.getCalendar.mockImplementation(async (_token, from, to) => ({
    from,
    to,
    ftpAvailable: true,
    items:
      from <= futureDate && to >= futureDate
        ? [{ ...workout, source: "ai", scheduledDate: futureDate }]
        : [],
  }));
  await open();
  await fireEvent.press(screen.getByText("›"));
  await waitFor(() => expect(screen.getByText("AI 教练 · 正式")).toBeTruthy());
});

test("calendar opens independent detail and edit routes; native back returns to detail", async () => {
  await open();
  await waitFor(() => expect(screen.getByText("查看课程")).toBeTruthy());
  expect(screen.getByRole("image", { name: /平均强度 125 W/ })).toBeTruthy();
  await fireEvent.press(screen.getByText("查看课程"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      `/workouts/${workout.id}`,
    ),
  );
  await waitFor(() => expect(screen.getByText("耐力骑行")).toBeTruthy());
  expect(screen.getByRole("header", { name: "课程详情" })).toBeTruthy();
  expect(
    within(screen.getByTestId("training-page-content")).queryByRole("header"),
  ).toBeNull();
  expect(api.getWorkout).toHaveBeenCalledWith("token", workout.id);
  expect(screen.queryByLabelText("删除第1个动作")).toBeNull();
  await fireEvent.press(screen.getByText("编辑动作"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/editor",
    ),
  );
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项")).toBeTruthy(),
  );
  expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
    "耐力骑行",
  );
  await back();
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      `/workouts/${workout.id}`,
    ),
  );
});

test("workout detail generates, previews, validates and applies an AI adjustment", async () => {
  await open(`/training?date=${today}`);
  await waitFor(() => expect(screen.getByText("查看课程")).toBeTruthy());
  await fireEvent.press(screen.getByText("查看课程"));
  await waitFor(() =>
    expect(screen.getByText("让 AI 调整这节课")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("让 AI 调整这节课"));
  await waitFor(() =>
    expect(screen.getByRole("header", { name: "调整训练" })).toBeTruthy(),
  );
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/adjust",
  );
  await waitFor(() => expect(screen.getByText("生成调整草稿")).toBeTruthy());
  await fireEvent.press(screen.getByText("生成调整草稿"));
  await waitFor(() =>
    expect(screen.getByText("确认这节训练的新方案？")).toBeTruthy(),
  );
  expect(coach.adjustWorkout).toHaveBeenCalledWith(
    "token",
    workout.id,
    expect.objectContaining({
      mode: "replace_workout",
      targetWorkoutId: workout.id,
      expectedBaseVersion: workout.planVersion,
    }),
    expect.any(String),
  );
  await fireEvent.press(screen.getByText("确认应用这节训练"));
  await waitFor(() =>
    expect(coach.validate).toHaveBeenCalledWith("token", aiProposal.proposalId),
  );
  expect(coach.apply).toHaveBeenCalledWith(
    "token",
    aiProposal.proposalId,
    aiProposal.basePlanVersion,
    expect.any(String),
  );
});

test("workout detail records partial completion feedback", async () => {
  await open(`/training?date=${today}`);
  await waitFor(() => expect(screen.getByText("查看课程")).toBeTruthy());
  await fireEvent.press(screen.getByText("查看课程"));
  await waitFor(() => expect(screen.getByText("记录训练反馈")).toBeTruthy());
  await fireEvent.press(screen.getByText("记录训练反馈"));
  await waitFor(() => expect(screen.getByText("保存训练反馈")).toBeTruthy());
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/feedback",
  );
  await fireEvent.press(screen.getByText("部分完成"));
  await fireEvent.changeText(screen.getByPlaceholderText("时长（分钟）"), "20");
  await fireEvent.changeText(screen.getByPlaceholderText("RPE 1-10"), "7");
  await fireEvent.changeText(screen.getByPlaceholderText("疲劳 1-10"), "6");
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：最后一组没有完成"),
    "最后一组没有完成",
  );
  api.getWorkout.mockResolvedValueOnce({
    ...workout,
    editable: false,
    activity: {
      id: "activity-1",
      status: "PARTIAL",
      durationMin: 20,
      rpe: 7,
      fatigue: 6,
      notes: "最后一组没有完成",
    },
  });
  await fireEvent.press(screen.getByText("保存训练反馈"));
  await waitFor(() =>
    expect(coach.recordActivity).toHaveBeenCalledWith("token", {
      workoutId: workout.id,
      localDate: today,
      status: "PARTIAL",
      durationMin: 20,
      rpe: 7,
      fatigue: 6,
      notes: "最后一组没有完成",
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      `/workouts/${workout.id}`,
    ),
  );
  await waitFor(() => expect(screen.getByText(/实际 20 分钟/)).toBeTruthy());
  expect(screen.getByRole("button", { name: "已记录训练反馈" })).toBeDisabled();
});

test("distance-only calendar cards keep distance information and actions without a chart", async () => {
  api.getCalendar.mockImplementation(async (_token, from, to) => ({
    from,
    to,
    ftpAvailable: false,
    items: [
      {
        ...workout,
        timeTargetMinutes: null,
        distanceTargetKm: 8,
        segments: [
          {
            ...workout.segments[0],
            target: { kind: "distance", value: 8, unit: "km" },
          },
        ],
      },
    ],
  }));
  await open();
  await waitFor(() => expect(screen.getByText("8 公里")).toBeTruthy());
  expect(screen.queryByText(/强度均值/)).toBeNull();
  expect(screen.getByText("查看课程")).toBeTruthy();
  expect(screen.getByText("编辑动作")).toBeTruthy();
});

test("new course saves to the formal plan in one action after returning from segment editing", async () => {
  await open();
  await waitFor(() => expect(screen.getByText("查看课程")).toBeTruthy());
  await fireEvent.press(screen.getByText("添加计划"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/new",
    ),
  );
  await waitFor(() =>
    expect(screen.queryByText("正在查询当天课程…")).toBeNull(),
  );
  await fireEvent.press(screen.getByText("创建第 2 节"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/editor",
    ),
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：爬坡专项"),
    "新课程",
  );
  await fireEvent.press(screen.getByText("添加动作"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/segment",
    ),
  );
  await fireEvent.press(screen.getByText("功率 W"));
  const required = screen.getAllByPlaceholderText("必填");
  await fireEvent.changeText(required[0], "30");
  await fireEvent.changeText(required[1], "100");
  await fireEvent.changeText(required[2], "150");
  await fireEvent.press(screen.getByText("保存动作"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/editor",
    ),
  );
  expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
    "新课程",
  );
  expect(screen.getByText("训练动作 · 1 个")).toBeTruthy();
  const beforeApply = api.getCalendar.mock.calls.length;
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/training"),
  );
  expect(api.createManual).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({ title: "新课程", segments: workout.segments }),
  );
  expect(api.createManual).toHaveBeenCalledTimes(1);
  expect(api.validate).toHaveBeenCalledWith("token", proposal.proposalId);
  expect(api.apply).toHaveBeenCalledWith(
    "token",
    proposal.proposalId,
    0,
    `training-${proposal.proposalId}`,
  );
  expect(screen.getByText("保存成功")).toBeTruthy();
  expect(screen.queryByText("校验课程")).toBeNull();
  await waitFor(() =>
    expect(api.getCalendar.mock.calls.length).toBeGreaterThan(beforeApply),
  );
});

test("unsaved edits ask for confirmation on native back and can stay on editor", async () => {
  await open();
  await waitFor(() => expect(screen.getByText("编辑动作")).toBeTruthy());
  await fireEvent.press(screen.getByText("编辑动作"));
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项")).toBeTruthy(),
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：爬坡专项"),
    "未保存",
  );
  await back();
  await waitFor(() =>
    expect(screen.getByText("还有未保存的课程修改")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("关闭"));
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/editor",
  );
  expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
    "未保存",
  );
});

test("preview can recover a server draft from proposal ID after reload", async () => {
  await open(`/workouts/preview?proposalId=${proposal.proposalId}`);
  await waitFor(() => expect(screen.getByText("校验课程")).toBeTruthy());
  expect(api.getProposal).toHaveBeenCalledWith("token", proposal.proposalId);
  await fireEvent.press(screen.getByText("继续编辑"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/editor",
    ),
  );
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
      "耐力骑行",
    ),
  );
});

test("editor reload restores saved changes before consulting the original workout", async () => {
  api.getProposal.mockResolvedValueOnce({
    ...proposal,
    draftWorkout: { ...workout, title: "服务端草稿修改" },
  });
  await open(
    `/workouts/editor?workoutId=${workout.id}&draftId=lost-local&proposalId=${proposal.proposalId}`,
  );
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
      "服务端草稿修改",
    ),
  );
  expect(api.getWorkout).not.toHaveBeenCalled();
});

test("expired local draft shows recovery action instead of blank editor", async () => {
  await open("/workouts/editor?draftId=expired-local");
  await waitFor(() =>
    expect(
      screen.getByText("本地草稿已失效，请返回训练页重新创建课程。"),
    ).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("返回训练"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/training"),
  );
});

test("detail handles unavailable data and retries the API", async () => {
  api.getWorkout.mockRejectedValueOnce(new Error("训练课程不存在"));
  await open(`/workouts/${workout.id}`);
  await waitFor(() => expect(screen.getByText("训练课程不存在")).toBeTruthy());
  await fireEvent.press(screen.getByText("重试"));
  await waitFor(() => expect(screen.getByText("耐力骑行")).toBeTruthy());
});

test("failed save keeps the course and error on editor for retry", async () => {
  api.createEdit.mockRejectedValueOnce(
    new Error("训练计划已被其他请求修改，请重新读取后再试"),
  );
  await open(`/workouts/editor?workoutId=${workout.id}`);
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项")).toBeTruthy(),
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：爬坡专项"),
    "保留的修改",
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(
      screen.getByText("训练计划已被其他请求修改，请重新读取后再试"),
    ).toBeTruthy(),
  );
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/editor",
  );
  expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
    "保留的修改",
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/training"),
  );
});

test("validation blockers stay in editor and corrected content reuses the same draft", async () => {
  api.validate.mockResolvedValueOnce({
    ...proposal,
    status: "BLOCKED",
    validation: { passed: false, warnings: [], blockers: ["当前没有可用 FTP"] },
  });
  await open(`/workouts/editor?workoutId=${workout.id}`);
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(screen.getByText("当前没有可用 FTP")).toBeTruthy(),
  );
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/editor",
  );
  expect(api.apply).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：爬坡专项"),
    "修正后的课程",
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/training"),
  );
  expect(api.createEdit).toHaveBeenCalledTimes(1);
  expect(api.updateProposal).toHaveBeenCalledWith(
    "token",
    proposal.proposalId,
    expect.objectContaining({
      expectedProposalVersion: 1,
      draft: expect.objectContaining({ title: "修正后的课程" }),
    }),
  );
  expect(api.apply).toHaveBeenCalledTimes(1);
});

test("apply timeout keeps the editor and retries the identical proposal without editing or validating it again", async () => {
  api.apply.mockRejectedValueOnce(new Error("连接超时，请检查网络后重试"));
  await open(`/workouts/editor?workoutId=${workout.id}`);
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(screen.getByText("连接超时，请检查网络后重试")).toBeTruthy(),
  );
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/editor",
  );
  expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
    "耐力骑行",
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/training"),
  );
  expect(api.createEdit).toHaveBeenCalledTimes(1);
  expect(api.updateProposal).not.toHaveBeenCalled();
  expect(api.validate).toHaveBeenCalledTimes(1);
  expect(api.apply).toHaveBeenCalledTimes(2);
  expect(api.apply.mock.calls[1]).toEqual(api.apply.mock.calls[0]);
});

test("while saving, repeated taps and native back cannot create another course or leave the editor", async () => {
  let resolveApply!: (
    result: Awaited<ReturnType<typeof trainingApi.apply>>,
  ) => void;
  api.apply.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveApply = resolve;
      }),
  );
  await open(`/workouts/editor?workoutId=${workout.id}`);
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项")).toBeTruthy(),
  );
  const saveButton = screen.getByText("保存当天课程");
  await fireEvent.press(saveButton);
  await waitFor(() => expect(api.apply).toHaveBeenCalledTimes(1));
  expect(screen.getByText("正在保存课程…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "返回上一页" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/editor",
  );
  expect(screen.getByPlaceholderText("例如：爬坡专项").props.editable).toBe(
    false,
  );
  await fireEvent.press(
    screen
      .getAllByRole("button")
      .find((button) => button.props.accessibilityState?.busy)!,
  );
  expect(api.createEdit).toHaveBeenCalledTimes(1);
  await act(async () => {
    router.replace("/(tabs)/training");
  });
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/editor",
  );
  await act(async () => {
    resolveApply({ success: true, newPlanVersion: 2, affectedDates: [today] });
  });
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/training"),
  );
});

test("new edits after an uncertain apply are retained when the original save already succeeded", async () => {
  api.apply.mockRejectedValueOnce(new Error("连接超时"));
  await open(`/workouts/editor?workoutId=${workout.id}`);
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() => expect(screen.getByText("连接超时")).toBeTruthy());
  api.getProposal.mockResolvedValueOnce({ ...proposal, status: "APPLIED" });
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：爬坡专项"),
    "新的修改",
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(screen.getByText(/上次课程已保存成功/)).toBeTruthy(),
  );
  expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
    "新的修改",
  );
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/editor",
  );
  expect(api.updateProposal).not.toHaveBeenCalled();
  expect(api.apply).toHaveBeenCalledTimes(1);
});

test("apply version conflict retains the course without claiming success", async () => {
  api.apply.mockRejectedValueOnce(
    new Error("训练计划已被其他请求修改，请重新读取后再试"),
  );
  await open(`/workouts/editor?workoutId=${workout.id}`);
  await waitFor(() =>
    expect(screen.getByPlaceholderText("例如：爬坡专项")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("保存当天课程"));
  await waitFor(() =>
    expect(
      screen.getByText("训练计划已被其他请求修改，请重新读取后再试"),
    ).toBeTruthy(),
  );
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/editor",
  );
  expect(screen.queryByText("保存成功")).toBeNull();
  expect(screen.getByPlaceholderText("例如：爬坡专项").props.value).toBe(
    "耐力骑行",
  );
});

test("unsaved segment confirms header back before discarding changes", async () => {
  await open(`/workouts/editor?workoutId=${workout.id}`);
  await waitFor(() => expect(screen.getByText("添加动作")).toBeTruthy());
  await fireEvent.press(screen.getByText("添加动作"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/segment",
    ),
  );
  await fireEvent.changeText(screen.getAllByPlaceholderText("必填")[0], "20");
  await fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  await waitFor(() =>
    expect(
      screen.getByText("当前动作尚未保存，确认返回将放弃这次动作修改。"),
    ).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("确认返回"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/editor",
    ),
  );
  expect(screen.getByText("训练动作 · 1 个")).toBeTruthy();
});

test("invalid segment link shows an error instead of overwriting an action", async () => {
  await open(`/workouts/segment?proposalId=${proposal.proposalId}&index=-1`);
  await waitFor(() =>
    expect(
      screen.getByText("训练动作不存在，请返回课程重新选择。"),
    ).toBeTruthy(),
  );
  expect(screen.queryByText("保存动作")).toBeNull();
});

test("incomplete date input remains editable without crashing or opening an editor", async () => {
  await open("/workouts/new");
  await waitFor(() =>
    expect(screen.queryByText("正在查询当天课程…")).toBeNull(),
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("YYYY-MM-DD"),
    "2026-",
  );
  await fireEvent.press(screen.getByText("创建第 1 节"));
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/new",
  );
  expect(
    screen.getByText("请选择当天或未来的有效日期（YYYY-MM-DD）"),
  ).toBeTruthy();
});

test("direct feedback route preserves failed input and refreshes detail after success", async () => {
  coach.recordActivity.mockRejectedValueOnce(new Error("保存超时"));
  await open(`/workouts/feedback?workoutId=${workout.id}&source=detail`);
  await waitFor(() => expect(screen.getByText("保存训练反馈")).toBeTruthy());
  await fireEvent.press(screen.getByText("部分完成"));
  await fireEvent.changeText(screen.getByPlaceholderText("时长（分钟）"), "20");
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：最后一组没有完成"),
    "保留这条反馈",
  );
  await fireEvent.press(screen.getByText("保存训练反馈"));
  await waitFor(() =>
    expect(screen.getAllByText("保存超时").length).toBeGreaterThan(0),
  );
  expect(screen.getByPlaceholderText("时长（分钟）").props.value).toBe("20");
  expect(
    screen.getByPlaceholderText("例如：最后一组没有完成").props.value,
  ).toBe("保留这条反馈");
  expect(coach.apply).not.toHaveBeenCalled();
  api.getWorkout.mockResolvedValueOnce({
    ...workout,
    editable: false,
    activity: {
      id: "record-1",
      status: "PARTIAL",
      durationMin: 20,
      rpe: null,
      fatigue: null,
      notes: "保留这条反馈",
    },
  });
  await fireEvent.press(screen.getByText("保存训练反馈"));
  await waitFor(() => expect(screen.getByText("已记录训练反馈")).toBeTruthy());
  expect(screen.getByText(/实际 20 分钟/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "已记录训练反馈" })).toBeDisabled();
  expect(api.getWorkout).toHaveBeenCalledTimes(2);
});

test("adjustment failure keeps notes, and apply timeout retries the identical write then reloads the new plan", async () => {
  coach.adjustWorkout.mockRejectedValueOnce(new Error("生成暂时失败"));
  coach.apply.mockRejectedValueOnce(new Error("应用响应超时"));
  await open(`/workouts/adjust?workoutId=${workout.id}`);
  await waitFor(() => expect(screen.getByText("生成调整草稿")).toBeTruthy());
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：昨晚只睡了 5 小时"),
    "只能训练二十分钟",
  );
  await fireEvent.press(screen.getByText("生成调整草稿"));
  await waitFor(() =>
    expect(screen.getAllByText("生成暂时失败").length).toBeGreaterThan(0),
  );
  expect(
    screen.getByPlaceholderText("例如：昨晚只睡了 5 小时").props.value,
  ).toBe("只能训练二十分钟");
  await fireEvent.press(screen.getByText("生成调整草稿"));
  await waitFor(() =>
    expect(screen.getByText("确认这节训练的新方案？")).toBeTruthy(),
  );
  await fireEvent.press(screen.getByText("确认应用这节训练"));
  await waitFor(() =>
    expect(screen.getAllByText("应用响应超时").length).toBeGreaterThan(0),
  );
  expect(screen.getByText("确认这节训练的新方案？")).toBeTruthy();
  await fireEvent.press(screen.getByText("确认应用这节训练"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/training"),
  );
  expect(coach.validate).toHaveBeenCalledTimes(1);
  expect(coach.apply.mock.calls[1]).toEqual(coach.apply.mock.calls[0]);
  expect(screen.getByText("保存成功")).toBeTruthy();
  expect(api.getWorkout).toHaveBeenCalledTimes(2);
});

test.each([
  ["调整这节训练", "/workouts/adjust", "调整训练"],
  ["记录完成情况", "/workouts/feedback", "记录完成"],
] as const)(
  "home %s opens one action route and cancel returns directly to home",
  async (label, path, title) => {
    await open("/");
    await waitFor(() => expect(screen.getByText(label)).toBeTruthy());
    await fireEvent.press(screen.getByText(label));
    await waitFor(() =>
      expect(screen.getByRole("header", { name: title })).toBeTruthy(),
    );
    expect(screen.getByTestId("current-path").props.children).toBe(path);
    expect(screen.queryByRole("header", { name: "课程详情" })).toBeNull();
    await waitFor(() => expect(screen.getByText("取消")).toBeTruthy());
    await fireEvent.press(screen.getByText("取消"));
    await waitFor(() =>
      expect(screen.getByTestId("current-path").props.children).toBe("/"),
    );
    expect(api.getWorkout).toHaveBeenCalledTimes(1);
    expect(coach.apply).not.toHaveBeenCalled();
    expect(coach.recordActivity).not.toHaveBeenCalled();
  },
);

test("home feedback saves once, blocks native back during save and refreshes home on return", async () => {
  let resolveSave!: (
    value: Awaited<ReturnType<typeof coachApi.recordActivity>>,
  ) => void;
  coach.recordActivity.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
  );
  await open("/");
  await waitFor(() => expect(screen.getByText("记录完成情况")).toBeTruthy());
  await fireEvent.press(screen.getByText("记录完成情况"));
  await waitFor(() => expect(screen.getByText("保存训练反馈")).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText("时长（分钟）"), "25");
  const reads = jest.mocked(homeApi.today).mock.calls.length;
  await fireEvent.press(screen.getByText("保存训练反馈"));
  expect(screen.getByRole("button", { name: "返回上一页" })).toBeDisabled();
  await back();
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/feedback",
  );
  expect(coach.recordActivity).toHaveBeenCalledTimes(1);
  await act(async () =>
    resolveSave({
      id: "feedback-id",
      workoutId: workout.id,
      localDate: today,
      status: "COMPLETED",
      durationMin: 25,
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/"),
  );
  await waitFor(() =>
    expect(jest.mocked(homeApi.today).mock.calls.length).toBeGreaterThan(reads),
  );
});

test.each(["adjust", "feedback"] as const)(
  "%s form confirms unsaved native back and keeps input when staying",
  async (action) => {
    await open("/");
    await waitFor(() => expect(screen.getByText("记录完成情况")).toBeTruthy());
    await fireEvent.press(
      screen.getByText(action === "adjust" ? "调整这节训练" : "记录完成情况"),
    );
    const placeholder =
      action === "adjust"
        ? "例如：昨晚只睡了 5 小时"
        : "例如：最后一组没有完成";
    await waitFor(() =>
      expect(screen.getByPlaceholderText(placeholder)).toBeTruthy(),
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText(placeholder),
      "保留的输入",
    );
    await back();
    await waitFor(() =>
      expect(screen.getByText("返回将放弃本次输入，确认离开？")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText("关闭"));
    expect(screen.getByPlaceholderText(placeholder).props.value).toBe(
      "保留的输入",
    );
    await fireEvent.press(screen.getByText("取消"));
    await waitFor(() => expect(screen.getByText("确认返回")).toBeTruthy());
    await fireEvent.press(screen.getByText("确认返回"));
    await waitFor(() =>
      expect(screen.getByTestId("current-path").props.children).toBe("/"),
    );
  },
);

test("home adjustment previews on its own route, preserves inputs on back and refreshes home after apply", async () => {
  await open("/");
  await waitFor(() => expect(screen.getByText("调整这节训练")).toBeTruthy());
  await fireEvent.press(screen.getByText("调整这节训练"));
  await waitFor(() => expect(screen.getByText("生成调整草稿")).toBeTruthy());
  await fireEvent.changeText(
    screen.getByPlaceholderText("例如：昨晚只睡了 5 小时"),
    "今天只有二十分钟",
  );
  await fireEvent.press(screen.getByText("生成调整草稿"));
  await waitFor(() =>
    expect(screen.getByRole("header", { name: "调整预览" })).toBeTruthy(),
  );
  expect(screen.getByTestId("current-path").props.children).toBe(
    "/workouts/adjustment-preview",
  );
  await waitFor(() => expect(screen.getByText("继续修改")).toBeTruthy());
  await fireEvent.press(screen.getByText("继续修改"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/adjust",
    ),
  );
  expect(
    screen.getByPlaceholderText("例如：昨晚只睡了 5 小时").props.value,
  ).toBe("今天只有二十分钟");
  await fireEvent.press(screen.getByText("生成调整草稿"));
  await waitFor(() =>
    expect(screen.getByText("确认应用这节训练")).toBeTruthy(),
  );
  const reads = jest.mocked(homeApi.today).mock.calls.length;
  await fireEvent.press(screen.getByText("确认应用这节训练"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe("/"),
  );
  await waitFor(() =>
    expect(jest.mocked(homeApi.today).mock.calls.length).toBeGreaterThan(reads),
  );
  expect(coach.apply).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("header", { name: "课程详情" })).toBeNull();
});

test.each(["adjust", "feedback"] as const)(
  "%s route handles unavailable courses and retry",
  async (action) => {
    api.getWorkout.mockRejectedValueOnce(new Error("课程暂时无法读取"));
    await open(`/workouts/${action}?workoutId=${workout.id}`);
    await waitFor(() =>
      expect(screen.getByText("课程暂时无法读取")).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "返回上一页" })).toBeTruthy();
    await fireEvent.press(screen.getByText("重试"));
    await waitFor(() =>
      expect(
        screen.getByText(action === "adjust" ? "生成调整草稿" : "保存训练反馈"),
      ).toBeTruthy(),
    );
  },
);

test("feedback rejects invalid numbers without discarding input or submitting", async () => {
  await open(`/workouts/feedback?workoutId=${workout.id}`);
  await waitFor(() => expect(screen.getByText("保存训练反馈")).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText("RPE 1-10"), "11");
  await fireEvent.press(screen.getByText("保存训练反馈"));
  expect(coach.recordActivity).not.toHaveBeenCalled();
  expect(screen.getByText(/请检查实际时长/)).toBeTruthy();
  expect(screen.getByPlaceholderText("RPE 1-10").props.value).toBe("11");
});

test.each(["adjust", "feedback"] as const)(
  "recorded courses cannot open the %s form",
  async (action) => {
    api.getWorkout.mockResolvedValueOnce({
      ...workout,
      editable: false,
      activity: {
        id: "activity-1",
        status: "COMPLETED",
        durationMin: 30,
        rpe: null,
        fatigue: null,
        notes: null,
      },
    });
    await open(`/workouts/${action}?workoutId=${workout.id}`);
    await waitFor(() =>
      expect(
        screen.getByText(
          action === "adjust"
            ? "当前课程已记录或不可调整，请返回刷新计划。"
            : "已记录训练反馈，无需重复提交。",
        ),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByText(action === "adjust" ? "生成调整草稿" : "保存训练反馈"),
    ).toBeNull();
  },
);

test("adjustment preview rejects a draft for another workout", async () => {
  coach.proposal.mockResolvedValueOnce({
    ...aiProposal,
    replaceWorkoutIds: ["another-workout"],
  });
  await open(
    `/workouts/adjustment-preview?workoutId=${workout.id}&proposalId=${aiProposal.proposalId}`,
  );
  await waitFor(() =>
    expect(
      screen.getByText("调整草稿与当前课程不匹配，请返回重新生成"),
    ).toBeTruthy(),
  );
  expect(screen.queryByText("确认应用这节训练")).toBeNull();
  expect(coach.apply).not.toHaveBeenCalled();
});
