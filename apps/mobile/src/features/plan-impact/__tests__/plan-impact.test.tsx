import { Stack, router } from "expo-router";
import { Text } from "react-native";
import {
  renderRouter,
  screen,
  fireEvent,
  act,
} from "expo-router/testing-library";
import type {
  PlanImpactPreview,
  PlanImpactDecisionResponse,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { waitForGeneration } from "../../goals/services/wait-for-generation";
import { planImpactApi } from "../services/plan-impact.api";
import { PlanImpactScreen } from "../screens/PlanImpactScreen";
import { PlanImpactPreviewScreen } from "../screens/PlanImpactPreviewScreen";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../services/plan-impact.api", () => ({
  planImpactApi: {
    preview: jest.fn(),
    decide: jest.fn(),
    decision: jest.fn(),
    apply: jest.fn(),
    generate: jest.fn(),
  },
}));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: { generation: jest.fn() },
}));
jest.mock("../../goals/services/wait-for-generation", () => ({
  waitForGeneration: jest.fn(),
}));
const api = jest.mocked(planImpactApi);
const id = "00000000-0000-4000-8000-000000000001";
const preview: PlanImpactPreview = {
  fingerprint: "a".repeat(64),
  localDate: "2099-01-01",
  basePlanVersion: 2,
  currentFtpWatts: 220,
  goalId: id,
  goalDescription: "耐力目标",

  stageMessages: ["阶段依据已变化，请到训练目标复评。"],
  protectedCount: 1,
  pendingCount: 1,
  decisions: [],
  generations: [],
  items: [
    {
      workout: {
        id,
        planVersion: 2,
        sportType: "cycling",
        source: "manual",
        title: "原耐力课",
        purpose: "基础耐力",
        scheduledDate: "2099-01-02",
        dayOrder: 1,
        timeTargetMinutes: 30,
        distanceTargetKm: null,
        segments: [
          {
            type: "work",
            target: { kind: "duration", value: 30, unit: "min" },
            intensity: { kind: "ftp_percent", min: 70, max: 70 },
          },
        ],
      },
      issues: ["FTP"],
      messages: ["课程按 200 W FTP 快照执行"],
      oldFtpWatts: 200,
      recalculable: true,
      power: [
        { before: "70–70% FTP · 140–140 W", after: "70–70% FTP · 154–154 W" },
      ],
    },
  ],
};
const draft: PlanImpactDecisionResponse = {
  id,
  action: "FTP_RECALCULATE",
  status: "DRAFT",
  startDate: "2099-01-01",
  endDate: "2099-01-14",
  basePlanVersion: 2,
  items: preview.items,
  newPlanVersion: null,
};
const job = {
  generationId: id,
  status: "READY" as const,
  proposalId: id,
  errorCode: null,
  requestId: id,
};
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  "plans/input-impact": PlanImpactScreen,
  "plans/input-impact-preview": PlanImpactPreviewScreen,
  "goals/course-preview": () => <Text>重排草稿预览确认页</Text>,
  "goals/index": () => <Text>目标与阶段管理页</Text>,
  "(tabs)/training": () => <Text>训练与补给日历</Text>,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useAuth)
    .mockReturnValue({ session: { accessToken: "token" } } as ReturnType<
      typeof useAuth
    >);
  api.preview.mockResolvedValue(preview);
  api.decide.mockResolvedValue(draft);
  api.decision.mockResolvedValue(draft);
  api.apply.mockResolvedValue({
    ...draft,
    status: "APPLIED",
    newPlanVersion: 3,
  });
  api.generate.mockResolvedValue(job);
  jest.mocked(coachApi.generation).mockResolvedValue(job);
  jest.mocked(waitForGeneration).mockResolvedValue(id);
});

test("save facts are separate from KEEP, confirmation can cancel, and KEEP has durable scope", async () => {
  await renderRouter(routes, { initialUrl: "/plans/input-impact" });
  await screen.findByText("1 节未来课程待核对");
  expect(screen.getByText(/140–140 W/)).toHaveTextContent(/154–154 W/);
  expect(api.decide).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("保留所选范围的安排"));
  await fireEvent.press(screen.getByText("继续核对"));
  expect(api.decide).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("处理结束日期"),
    "2099-01-03",
  );
  await fireEvent.press(screen.getByText("保留所选范围的安排"));
  api.decide.mockResolvedValueOnce({
    ...draft,
    action: "KEEP",
    status: "APPLIED",
  });
  await fireEvent.press(screen.getByText("确认保留安排"));
  await screen.findByText("已保留所选范围的安排，课程继续按原功率依据执行。");
  expect(api.decide).toHaveBeenCalledWith(
    "token",
    {
      action: "KEEP",
      fingerprint: preview.fingerprint,
      startDate: "2099-01-01",
      endDate: "2099-01-03",
    },
    expect.any(String),
  );
  expect(api.apply).not.toHaveBeenCalled();
});

test("FTP calculation previews first and an uncertain application retries the same decision", async () => {
  await renderRouter(routes, { initialUrl: "/plans/input-impact" });
  await fireEvent.press(await screen.findByText("仅重算 FTP · 预览功率差异"));
  await screen.findByText("确认应用 FTP 重算");
  expect(api.apply).not.toHaveBeenCalled();
  api.apply.mockRejectedValueOnce(new Error("网络中断，请重试"));
  await fireEvent.press(screen.getByText("确认应用 FTP 重算"));
  await screen.findByText("网络中断，请重试");
  api.decision.mockResolvedValue({
    ...draft,
    status: "APPLIED",
    newPlanVersion: 3,
  });
  await fireEvent.press(screen.getByText("确认应用 FTP 重算"));
  await screen.findByText("已应用为正式版本 V3，请到训练日历核对补给。");
  expect(api.apply).toHaveBeenNthCalledWith(1, "token", id);
  expect(api.apply).toHaveBeenNthCalledWith(2, "token", id);
  await fireEvent.press(screen.getByText("查看训练与补给"));
  await screen.findByText("训练与补给日历");
});

test("stale drafts show server conflict and never report success", async () => {
  api.apply.mockRejectedValue(
    new Error("训练资料、反馈或处理决定已变化，请重新查看影响并生成草稿"),
  );
  await renderRouter(routes, {
    initialUrl: `/plans/input-impact-preview?decisionId=${id}`,
  });
  await fireEvent.press(await screen.findByText("确认应用 FTP 重算"));
  await screen.findByText(
    "训练资料、反馈或处理决定已变化，请重新查看影响并生成草稿",
  );
  expect(screen.queryByText(/已应用为正式版本/)).toBeNull();
  await fireEvent.press(screen.getByText("返回核对其他日期"));
  await screen.findByText("1 节未来课程待核对");
});

test("bad dates do not create drafts, and failed creation reuses an identical request key", async () => {
  await renderRouter(routes, { initialUrl: "/plans/input-impact" });
  await screen.findByText("1 节未来课程待核对");
  await fireEvent.changeText(screen.getByLabelText("处理结束日期"), "错误日期");
  await fireEvent.press(screen.getByText("仅重算 FTP · 预览功率差异"));
  await screen.findByText(/请选择今天或未来的有效日期/);
  expect(api.decide).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("处理结束日期"),
    "2099-01-14",
  );
  api.decide.mockRejectedValueOnce(new Error("创建请求超时"));
  await fireEvent.press(screen.getByText("仅重算 FTP · 预览功率差异"));
  await screen.findByText("创建请求超时");
  await fireEvent.press(screen.getByText("仅重算 FTP · 预览功率差异"));
  await screen.findByText("确认应用 FTP 重算");
  expect(api.decide.mock.calls[0]).toEqual(api.decide.mock.calls[1]);
});

test("re-entering the page resumes a saved generation without submitting or applying again", async () => {
  api.preview.mockResolvedValue({
    ...preview,
    generations: [
      {
        id,
        status: "RUNNING",
        proposalId: null,
        startDate: "2099-01-01",
        endDate: "2099-01-14",
      },
    ],
  });
  await renderRouter(routes, { initialUrl: "/plans/input-impact" });
  await fireEvent.press(await screen.findByText("继续查看重排任务"));
  await screen.findByText("重排草稿预览确认页");
  expect(coachApi.generation).toHaveBeenCalledWith("token", id);
  expect(api.generate).not.toHaveBeenCalled();
  expect(api.apply).not.toHaveBeenCalled();
});

test("loading failure is recoverable and paused goals allow KEEP while blocking generation", async () => {
  api.preview.mockRejectedValueOnce(new Error("读取影响失败"));
  await renderRouter(routes, { initialUrl: "/plans/input-impact" });
  await screen.findByText("读取影响失败");
  api.preview.mockResolvedValue({
    ...preview,
    goalId: null,
    goalDescription: null,
  });
  await fireEvent.press(screen.getByText("重试"));
  await screen.findByText("暂无活跃目标", { exact: false });
  expect(screen.getByText("按最新资料生成重排草稿")).toBeDisabled();
  expect(screen.getByText("保留所选范围的安排")).toBeEnabled();
});

test("explicit replan produces a preview and never applies it automatically", async () => {
  await renderRouter(routes, { initialUrl: "/plans/input-impact" });
  await fireEvent.press(await screen.findByText("按最新资料生成重排草稿"));
  await screen.findByText("重排草稿预览确认页");
  expect(api.generate).toHaveBeenCalledWith(
    "token",
    {
      fingerprint: preview.fingerprint,
      startDate: "2099-01-01",
      endDate: "2099-01-14",
    },
    expect.any(String),
  );
  expect(api.apply).not.toHaveBeenCalled();
});

test("leaving a running generation does not navigate back automatically or keep the page locked", async () => {
  let finish!: (id: string) => void;
  jest.mocked(waitForGeneration).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await renderRouter(routes, { initialUrl: "/plans/input-impact" });
  await fireEvent.press(await screen.findByText("按最新资料生成重排草稿"));
  expect(screen.getByRole("button", { name: "返回上一页" })).toBeEnabled();
  await act(() => router.push("/goals"));
  await screen.findByText("目标与阶段管理页");
  await act(() => finish(id));
  expect(screen.queryByText("重排草稿预览确认页")).toBeNull();
  await act(() => router.back());
  expect(await screen.findByText("按最新资料生成重排草稿")).toBeEnabled();
  expect(api.generate).toHaveBeenCalledTimes(1);
});
