import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type {
  AiProposalResponse,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { router } from "expo-router";
import { coachApi, CoachApiError } from "../../coach/services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";
import { RaceProposalScreen } from "../screens/RaceProposalScreen";
import { RaceNutritionProposalScreen } from "../screens/RaceNutritionProposalScreen";

let mockParams = { raceId: "race-1" };
let mockFocused = true;
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  // Match focus-effect dependency cleanup, including state-triggered rerenders.
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(() => {
      if (mockFocused) return effect();
    }, [effect, mockFocused]),
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../coach/services/coach.api", () => ({
  CoachApiError: jest.requireActual("../../coach/services/coach.api")
    .CoachApiError,
  coachApi: {
    race: jest.fn(),
    raceTrainingState: jest.fn(),
    raceImpact: jest.fn(),
    goals: jest.fn(),
    planStatus: jest.fn(),
    readiness: jest.fn(),
    replanRace: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
    apply: jest.fn(),
    validate: jest.fn(),
  },
}));
jest.mock("../../nutrition/services/nutrition.api", () => ({
  nutritionApi: {
    raceState: jest.fn(),
    getPlan: jest.fn(),
    generate: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
    apply: jest.fn(),
    validate: jest.fn(),
  },
}));
jest.mock("../../training/components/TrainingPage", () => ({
  TrainingPage: ({
    loading,
    error,
    retry,
    children,
  }: {
    loading?: boolean;
    error?: string;
    retry?: () => void;
    children?: React.ReactNode;
  }) => {
    const { Text } = jest.requireActual("react-native");
    return loading ? (
      <Text>加载中</Text>
    ) : error ? (
      <>
        <Text>{error}</Text>
        <Text onPress={retry}>重试</Text>
      </>
    ) : (
      children
    );
  },
}));
jest.mock("../../coach/components/PlanPreview", () => ({
  PlanPreview: ({ proposal }: { proposal: AiProposalResponse }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{proposal.summary}</Text>;
  },
}));
jest.mock("../../nutrition/components/NutritionProposalCard", () => ({
  NutritionProposalCard: ({
    proposal,
  }: {
    proposal: NutritionProposalResponse;
  }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{proposal.metadata?.summary}</Text>;
  },
}));

const coach = jest.mocked(coachApi);
const nutrition = jest.mocked(nutritionApi);
const ready = {
  generationId: "job-1",
  status: "READY" as const,
  proposalId: "proposal-1",
  errorCode: null,
  requestId: null,
};
const draft = {
  proposalId: "proposal-1",
  summary: "备赛训练预览",
  status: "READY",
  basePlanVersion: 2,
  blockers: [],
} as unknown as AiProposalResponse;
const nutritionDraft = {
  proposalId: "nutrition-1",
  metadata: { summary: "赛事补给预览" },
} as unknown as NutritionProposalResponse;

beforeEach(() => {
  jest.resetAllMocks();
  mockParams = { raceId: "race-1" };
  mockFocused = true;
  jest.mocked(useAuth).mockReturnValue({
    session: { accessToken: "token" },
  } as ReturnType<typeof useAuth>);
  coach.race.mockResolvedValue({
    id: "race-1",
    localDate: "2030-06-09",
  } as Awaited<ReturnType<typeof coachApi.race>>);
  coach.goals.mockResolvedValue([
    {
      id: "goal-1",
      status: "ACTIVE",
      priority: "PRIMARY",
    } as Awaited<ReturnType<typeof coachApi.goals>>[number],
  ]);
  coach.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 2 });
  coach.readiness.mockResolvedValue({
    ready: true,
    missingFields: [],
    activePlanVersion: 2,
  });
  coach.raceTrainingState.mockResolvedValue({
    phase: "PREPARATION",
    today: "2030-06-03",
    startDate: "2030-06-03",
    endDate: "2030-06-16",
    generation: null,
    proposal: null,
    message: null,
  });
  coach.raceImpact.mockResolvedValue({
    startDate: "2030-06-03",
    endDate: "2030-06-16",
    conflicts: [],
    workouts: [],
    stages: [],
    messages: [],
  } as unknown as Awaited<ReturnType<typeof coachApi.raceImpact>>);
  coach.replanRace.mockResolvedValue(ready);
  coach.generation.mockResolvedValue(ready);
  coach.proposal.mockResolvedValue(draft);
  nutrition.raceState.mockResolvedValue({ generation: null, proposal: null });
  nutrition.getPlan.mockResolvedValue({ version: 3 } as Awaited<
    ReturnType<typeof nutritionApi.getPlan>
  >);
  nutrition.generate.mockResolvedValue(ready);
  nutrition.proposal.mockResolvedValue(nutritionDraft);
});

async function startRaceDraft() {
  const view = await render(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("生成备赛计划草稿")).toBeTruthy());
  expect(coach.replanRace).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText("生成备赛计划草稿"));
  return view;
}

test("进入页面和重新聚焦只读取资料，不自动生成", async () => {
  const view = await render(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("生成备赛计划草稿")).toBeTruthy());
  mockFocused = false;
  await view.rerender(<RaceProposalScreen />);
  mockFocused = true;
  await view.rerender(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("生成备赛计划草稿")).toBeTruthy());
  expect(coach.replanRace).not.toHaveBeenCalled();
});

test("备赛生成完成后退出 loading，展示草稿且不自动应用", async () => {
  const view = await startRaceDraft();
  await waitFor(() => expect(view.getByText("备赛训练预览")).toBeTruthy());
  expect(view.queryByText("加载中")).toBeNull();
  expect(coach.replanRace).toHaveBeenCalledTimes(1);
  expect(coach.apply).not.toHaveBeenCalled();
});

test("备赛请求失败后显示错误并允许重试", async () => {
  coach.replanRace.mockRejectedValueOnce(new Error("连接超时，请重试"));
  const view = await startRaceDraft();
  await waitFor(() => expect(view.getByText("连接超时，请重试")).toBeTruthy());
  await fireEvent.press(view.getByText("重新生成备赛计划草稿"));
  await waitFor(() => expect(view.getByText("备赛训练预览")).toBeTruthy());
  expect(coach.replanRace).toHaveBeenCalledTimes(2);
});

test("后台生成失败会退出 loading 并显示错误", async () => {
  const failed = {
    ...ready,
    status: "FAILED" as const,
    proposalId: null,
    errorCode: "AI_OUTPUT_INVALID",
  };
  coach.replanRace.mockResolvedValue(failed);
  coach.generation.mockResolvedValue(failed);
  const view = await startRaceDraft();
  await waitFor(() => expect(view.getByText(/AI_OUTPUT_INVALID/)).toBeTruthy());
  expect(view.queryByText("加载中")).toBeNull();
});

test("排队中的备赛任务轮询完成后展示草稿", async () => {
  jest.useFakeTimers();
  try {
    coach.replanRace.mockResolvedValue({
      ...ready,
      status: "QUEUED",
      proposalId: null,
    });
    const view = await startRaceDraft();
    expect(view.getByText("加载中")).toBeTruthy();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
    expect(view.getByText("备赛训练预览")).toBeTruthy();
    expect(coach.generation).toHaveBeenCalledWith("token", "job-1");
  } finally {
    jest.useRealTimers();
  }
});

test("备赛任务等待超时后显示错误而不是永久 loading", async () => {
  jest.useFakeTimers();
  try {
    const queued = { ...ready, status: "QUEUED" as const, proposalId: null };
    coach.replanRace.mockResolvedValue(queued);
    coach.generation.mockResolvedValue(queued);
    const view = await startRaceDraft();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150_000);
    });
    expect(
      view.getByText("生成等待超时，请重试；正式计划没有变化"),
    ).toBeTruthy();
    expect(view.queryByText("加载中")).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

test("离开页面后停止轮询旧任务", async () => {
  jest.useFakeTimers();
  try {
    coach.replanRace.mockResolvedValue({
      ...ready,
      status: "RUNNING",
      proposalId: null,
    });
    const view = await startRaceDraft();
    expect(coach.replanRace).toHaveBeenCalledTimes(1);
    await view.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(coach.generation).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test("没有正式计划时直接生成备赛草稿，基准版本为 0", async () => {
  coach.planStatus.mockResolvedValue({ hasActivePlan: false, planVersion: 0 });
  const view = await startRaceDraft();
  await waitFor(() => expect(view.getByText("备赛训练预览")).toBeTruthy());
  expect(coach.replanRace).toHaveBeenCalledWith(
    "token",
    "race-1",
    expect.objectContaining({
      expectedBaseVersion: 0,
      weekStartDate: "2030-06-03",
    }),
    expect.any(String),
  );
  expect(coach.apply).not.toHaveBeenCalled();
});

test.each([
  "ftp",
  "goal",
  "availability",
  "experienceLevel",
  "weightKg",
] as const)("缺少 %s 时提供补填入口，补填返回后生成", async (field) => {
  coach.readiness.mockResolvedValue({
    ready: false,
    missingFields: [field],
    activePlanVersion: 0,
  });
  const view = await render(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("去填写基本信息")).toBeTruthy());
  expect(coach.replanRace).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText("去填写基本信息"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/races/training-setup",
    params: { raceId: "race-1" },
  });
  mockFocused = false;
  await view.rerender(<RaceProposalScreen />);
  coach.readiness.mockResolvedValue({
    ready: true,
    missingFields: [],
    activePlanVersion: 0,
  });
  mockFocused = true;
  await view.rerender(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("生成备赛计划草稿")).toBeTruthy());
  expect(coach.replanRace).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText("生成备赛计划草稿"));
  await waitFor(() => expect(view.getByText("备赛训练预览")).toBeTruthy());
});

test("提交时资料发生变化也能转到补填引导", async () => {
  coach.replanRace.mockRejectedValueOnce(
    new CoachApiError("请先补全训练资料", 400, "INSUFFICIENT_TRAINING_INPUT", [
      "availability",
    ]),
  );
  const view = await startRaceDraft();
  await waitFor(() => expect(view.getByText("去填写基本信息")).toBeTruthy());
});

test("赛事补给生成完成后退出 loading，展示草稿且不自动应用", async () => {
  const view = await render(<RaceNutritionProposalScreen />);
  await waitFor(() => expect(view.getByText("赛事补给预览")).toBeTruthy());
  expect(view.queryByText("加载中")).toBeNull();
  expect(nutrition.generate).toHaveBeenCalledTimes(1);
  expect(nutrition.apply).not.toHaveBeenCalled();
});

test("赛事补给失败后可重试", async () => {
  nutrition.generate.mockRejectedValueOnce(new Error("营养服务连接超时"));
  const view = await render(<RaceNutritionProposalScreen />);
  await waitFor(() => expect(view.getByText("营养服务连接超时")).toBeTruthy());
  await fireEvent.press(view.getByText("重试"));
  await waitFor(() => expect(view.getByText("赛事补给预览")).toBeTruthy());
});

test.each([
  ["备赛", RaceProposalScreen, "备赛训练预览"],
  ["补给", RaceNutritionProposalScreen, "赛事补给预览"],
])("%s页失焦再返回后能正常显示草稿", async (_name, Component, preview) => {
  const view = await render(<Component />);
  if (Component === RaceProposalScreen) {
    await waitFor(() =>
      expect(view.getByText("生成备赛计划草稿")).toBeTruthy(),
    );
    await fireEvent.press(view.getByText("生成备赛计划草稿"));
  }
  await waitFor(() => expect(view.getByText(preview)).toBeTruthy());
  mockFocused = false;
  await view.rerender(<Component />);
  mockFocused = true;
  await view.rerender(<Component />);
  if (Component === RaceProposalScreen) {
    await waitFor(() =>
      expect(view.getByText("生成备赛计划草稿")).toBeTruthy(),
    );
    expect(coach.replanRace).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByText("生成备赛计划草稿"));
  }
  await waitFor(() => expect(view.getByText(preview)).toBeTruthy());
  expect(view.queryByText("加载中")).toBeNull();
});

test("切换赛事后忽略旧请求结果，保留新赛事的草稿", async () => {
  let finishOld!: (value: AiProposalResponse) => void;
  coach.proposal.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  const view = await startRaceDraft();
  await waitFor(() => expect(coach.proposal).toHaveBeenCalledTimes(1));
  mockParams = { raceId: "race-2" };
  coach.race.mockResolvedValue({
    id: "race-2",
    localDate: "2030-06-16",
  } as Awaited<ReturnType<typeof coachApi.race>>);
  coach.proposal.mockResolvedValue({ ...draft, summary: "新赛事草稿" });
  await view.rerender(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("生成备赛计划草稿")).toBeTruthy());
  await fireEvent.press(view.getByText("生成备赛计划草稿"));
  await waitFor(() => expect(view.getByText("新赛事草稿")).toBeTruthy());
  await act(async () => finishOld(draft));
  expect(view.getByText("新赛事草稿")).toBeTruthy();
  expect(view.queryByText("备赛训练预览")).toBeNull();
});

test("恢复不足显示中文错误，只有手动重新生成才创建新任务", async () => {
  coach.replanRace.mockResolvedValueOnce({
    ...ready,
    status: "FAILED",
    proposalId: null,
    errorCode: "insufficient_recovery",
  });
  const view = await startRaceDraft();
  await waitFor(() =>
    expect(view.getByText(/草稿包含连续高强度训练/)).toBeTruthy(),
  );
  expect(coach.replanRace).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByText("重新生成备赛计划草稿"));
  await waitFor(() => expect(view.getByText("备赛训练预览")).toBeTruthy());
  expect(coach.replanRace).toHaveBeenCalledTimes(2);
});

test("已应用备赛方案重新进入时恢复展示，不重新生成或重复应用", async () => {
  coach.raceTrainingState.mockResolvedValue({
    phase: "PREPARATION",
    today: "2030-06-03",
    startDate: "2030-06-03",
    endDate: "2030-06-16",
    generation: ready,
    proposal: { ...draft, status: "APPLIED" },
    message: null,
  });
  const view = await render(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("已应用备赛计划")).toBeTruthy());
  expect(coach.replanRace).not.toHaveBeenCalled();
  expect(view.queryByText("确认应用备赛计划")).toBeNull();
  await fireEvent.press(view.getByText("重新生成备赛计划草稿"));
  await waitFor(() =>
    expect(coach.replanRace).toHaveBeenCalledWith(
      "token",
      "race-1",
      expect.objectContaining({
        forceRegenerate: true,
        mode: "range",
        endDate: "2030-06-16",
      }),
      expect.any(String),
    ),
  );
  expect(coach.apply).not.toHaveBeenCalled();
});

test("自选跨周范围先预览影响，再由点击生成", async () => {
  const view = await render(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("生成备赛计划草稿")).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText("结束日期"), "2030-06-23");
  await fireEvent.press(view.getByText("查看范围影响"));
  await waitFor(() =>
    expect(coach.raceImpact).toHaveBeenCalledWith("token", "race-1", {
      startDate: "2030-06-03",
      endDate: "2030-06-23",
    }),
  );
  expect(coach.replanRace).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText("生成备赛计划草稿"));
  await waitFor(() =>
    expect(coach.replanRace).toHaveBeenCalledWith(
      "token",
      "race-1",
      expect.objectContaining({
        weekStartDate: "2030-06-03",
        endDate: "2030-06-23",
        mode: "range",
      }),
      expect.any(String),
    ),
  );
});

test.each(["RECOVERY", "RETURN_TO_GOAL"] as const)(
  "%s 从当前日期生成并明确确认",
  async (phase) => {
    const label = phase === "RECOVERY" ? "赛后恢复" : "回归目标";
    coach.raceTrainingState.mockResolvedValue({
      phase,
      today: "2030-06-17",
      startDate: "2030-06-17",
      endDate: "2030-06-30",
      generation: null,
      proposal: null,
      message: null,
    });
    const view = await render(<RaceProposalScreen />);
    await waitFor(() =>
      expect(view.getByText(`生成${label}计划草稿`)).toBeTruthy(),
    );
    expect(coach.replanRace).not.toHaveBeenCalled();
    await fireEvent.press(view.getByText(`生成${label}计划草稿`));
    await waitFor(() =>
      expect(view.getByText(`确认应用${label}计划`)).toBeTruthy(),
    );
    expect(coach.replanRace).toHaveBeenCalledWith(
      "token",
      "race-1",
      expect.objectContaining({
        weekStartDate: "2030-06-17",
        endDate: "2030-06-30",
        racePhase: phase,
      }),
      expect.any(String),
    );
  },
);

test("应用失败重试沿用幂等键，成功后显示已应用", async () => {
  coach.apply.mockRejectedValueOnce(new Error("网络中断"));
  const view = await startRaceDraft();
  await waitFor(() => expect(view.getByText("确认应用备赛计划")).toBeTruthy());
  await fireEvent.press(view.getByText("确认应用备赛计划"));
  await waitFor(() => expect(view.getByText("网络中断")).toBeTruthy());
  const firstKey = coach.apply.mock.calls[0][3];
  await fireEvent.press(view.getByText("确认应用备赛计划"));
  await waitFor(() => expect(view.getByText("已应用备赛计划")).toBeTruthy());
  expect(coach.apply.mock.calls[1][3]).toBe(firstKey);
});

test("读取任务无响应时整体超时退出 loading，重试只查询不创建任务", async () => {
  jest.useFakeTimers();
  try {
    coach.raceTrainingState.mockImplementationOnce(() => new Promise(() => {}));
    const view = await render(<RaceProposalScreen />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(180_000);
    });
    expect(view.getByText(/赛事训练等待超时/)).toBeTruthy();
    expect(view.queryByText("加载中")).toBeNull();
    await fireEvent.press(view.getByText("重试"));
    await waitFor(() =>
      expect(view.getByText("生成备赛计划草稿")).toBeTruthy(),
    );
    expect(coach.replanRace).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test("修改范围后不能误应用旧范围草稿", async () => {
  const matching = {
    ...draft,
    weekStartDate: "2030-06-03",
    endDate: "2030-06-16",
  };
  coach.raceTrainingState.mockResolvedValue({
    phase: "PREPARATION",
    today: "2030-06-03",
    startDate: "2030-06-03",
    endDate: "2030-06-16",
    generation: ready,
    proposal: matching,
    message: null,
  });
  const view = await render(<RaceProposalScreen />);
  await waitFor(() => expect(view.getByText("确认应用备赛计划")).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText("结束日期"), "2030-06-23");
  expect(
    view.getByText("日期范围已修改，请重新生成后再确认应用。"),
  ).toBeTruthy();
  await fireEvent.press(view.getByText("确认应用备赛计划"));
  expect(coach.apply).not.toHaveBeenCalled();
});
