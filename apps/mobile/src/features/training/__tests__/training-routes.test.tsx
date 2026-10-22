import { Text } from "react-native";
import { Stack, router, usePathname } from "expo-router";
import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
  act,
} from "expo-router/testing-library";
import type { ProposalResponse } from "@ridepilot/contracts";
import TabsLayout from "../../../../app/(tabs)/_layout";
import WorkoutLayout from "../../../../app/workouts/_layout";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { trainingApi } from "../services/training.api";
import { TrainingScreen } from "../screens/TrainingScreen";
import { NewWorkoutScreen } from "../screens/NewWorkoutScreen";
import { WorkoutDetailScreen } from "../screens/WorkoutDetailScreen";
import { WorkoutEditorScreen } from "../screens/WorkoutEditorScreen";
import { WorkoutPreviewScreen } from "../screens/WorkoutPreviewScreen";
import { WorkoutSegmentScreen } from "../screens/WorkoutSegmentScreen";
import { iso } from "../model/training";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
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
  "(tabs)/index": () => null,
  "(tabs)/nutrition": () => null,
  "(tabs)/coach": () => null,
  "(tabs)/profile": () => null,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/training": TrainingScreen,
  "workouts/_layout": WorkoutLayout,
  "workouts/new": NewWorkoutScreen,
  "workouts/editor": WorkoutEditorScreen,
  "workouts/segment": WorkoutSegmentScreen,
  "workouts/preview": WorkoutPreviewScreen,
  "workouts/[workoutId]": WorkoutDetailScreen,
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
  api.getCalendar.mockImplementation(async (_token, from, to) => ({
    from,
    to,
    ftpAvailable: false,
    items: [workout],
  }));
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
});

async function open(url = "/training") {
  await renderRouter(routes, { initialUrl: url });
}
async function back() {
  await act(async () => {
    router.back();
  });
}

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

test("unsaved segment confirms native back before discarding changes", async () => {
  await open(`/workouts/editor?workoutId=${workout.id}`);
  await waitFor(() => expect(screen.getByText("添加动作")).toBeTruthy());
  await fireEvent.press(screen.getByText("添加动作"));
  await waitFor(() =>
    expect(screen.getByTestId("current-path").props.children).toBe(
      "/workouts/segment",
    ),
  );
  await fireEvent.changeText(screen.getAllByPlaceholderText("必填")[0], "20");
  await back();
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
