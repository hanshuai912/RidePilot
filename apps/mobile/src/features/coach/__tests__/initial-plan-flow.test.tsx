import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import type { AiProposalResponse, ProfileResponse } from "@ridepilot/contracts";

import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile, patchProfile } from "../../profile/services/profile.api";
import { trainingApi } from "../../training/services/training.api";
import { CoachFlowProvider } from "../hooks/CoachFlowContext";
import { useInitialPlan } from "../hooks/useInitialPlan";
import { CoachScreen } from "../screens/CoachScreen";
import { coachApi } from "../services/coach.api";

let mockPathname = "/coach";
const mockNavigate = jest.fn((href: unknown) => {
  const rawPath =
    typeof href === "string"
      ? href
      : typeof href === "object" && href !== null && "pathname" in href
        ? String((href as { pathname: unknown }).pathname)
        : null;
  if (rawPath) mockPathname = rawPath.replace("/(tabs)", "");
});

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, []),
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockNavigate,
    replace: mockNavigate,
    back: jest.fn(),
  }),
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
  patchProfile: jest.fn(),
}));
jest.mock("../../training/services/training.api", () => ({
  trainingApi: { getCalendar: jest.fn() },
}));
jest.mock("../services/coach.api", () => ({
  coachApi: {
    planStatus: jest.fn(),
    readiness: jest.fn(),
    ftp: jest.fn(),
    availability: jest.fn(),
    saveAvailability: jest.fn(),
    goals: jest.fn(),
    createGoal: jest.fn(),
    updateGoal: jest.fn(),
    generate: jest.fn(),
    adjustPlan: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
    validate: jest.fn(),
    apply: jest.fn(),
  },
}));

const api = jest.mocked(coachApi);
const calendarApi = jest.mocked(trainingApi);
const profile: ProfileResponse = {
  userId: "00000000-0000-4000-8000-000000000001",
  displayName: "骑行者",
  phoneMasked: "138****5678",
  phoneVerificationStatus: "UNVERIFIED",
  gender: null,
  birthDate: null,
  heightCm: 170,
  weightKg: 55,
  experienceLevel: "BEGINNER",
  timezone: "Asia/Shanghai",
  locale: "zh-CN",
  version: 1,
};
const goal = {
  id: "00000000-0000-4000-8000-000000000002",
  type: "FTP" as const,
  description: null,
  targetWkg: 4,
  targetDate: "2030-06-01",
  priority: "PRIMARY" as const,
  status: "ACTIVE" as const,
  version: 1,
};
const availability = {
  timezone: "Asia/Shanghai",
  weekdays: [{ weekday: 2, availableMinutes: 60 }],
  maxSessionMinutes: 60,
  version: 1,
};
const proposal: AiProposalResponse = {
  proposalId: "00000000-0000-4000-8000-000000000003",
  status: "READY",
  proposalVersion: 1,
  basePlanVersion: 0,
  scene: "WEEK_PLAN",
  replaceWorkoutIds: [],
  weekStartDate: "2030-01-07",
  summary: "保守起始周",
  stageSummary: "建立训练习惯",
  assessmentSuggestion: "数周后复评",
  workouts: [
    {
      scheduledDate: "2030-01-08",
      title: "有氧训练",
      purpose: "建立基础",
      segments: [
        {
          type: "work",
          target: { kind: "duration", value: 40, unit: "min" },
          intensity: { kind: "ftp_percent", min: 60, max: 70 },
        },
      ],
    },
  ],
  warnings: [],
  blockers: [],
  skillVersion: "1.1.0",
  model: "test-model",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/coach";
  jest.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    session: {
      user: { id: profile.userId, phone: "13812345678", phoneVerified: false },
      accessToken: "token",
      expiresAt: Date.now() + 60_000,
    },
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
  });
  jest.mocked(getProfile).mockResolvedValue(profile);
  jest.mocked(patchProfile).mockResolvedValue(profile);
  api.planStatus.mockResolvedValue({ hasActivePlan: false, planVersion: 0 });
  api.readiness.mockResolvedValue({
    ready: true,
    missingFields: [],
    activePlanVersion: 0,
  });
  api.ftp.mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000004",
    valueWatts: 193,
    measuredAt: new Date().toISOString(),
    source: "MANUAL",
  });
  api.availability.mockResolvedValue(null);
  api.saveAvailability.mockResolvedValue(availability);
  api.goals.mockResolvedValue([]);
  api.createGoal.mockResolvedValue(goal);
  api.generate.mockResolvedValue({
    generationId: "00000000-0000-4000-8000-000000000005",
    status: "READY",
    proposalId: proposal.proposalId,
    errorCode: null,
    requestId: "request-1",
  });
  api.adjustPlan.mockResolvedValue({
    generationId: "00000000-0000-4000-8000-000000000005",
    status: "READY",
    proposalId: proposal.proposalId,
    errorCode: null,
    requestId: "request-1",
  });
  calendarApi.getCalendar.mockResolvedValue({
    from: "2030-01-07",
    to: "2030-01-13",
    ftpAvailable: true,
    items: [],
  });
  api.proposal.mockResolvedValue(proposal);
  api.validate.mockResolvedValue(proposal);
  api.apply.mockResolvedValue({
    success: true,
    newPlanVersion: 1,
    affectedDates: [proposal.workouts[0].scheduledDate],
  });
});

test("missing FTP blocks the wizard and points to personal data", async () => {
  api.ftp.mockResolvedValue(null);
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.nextFromBasics();
  });
  expect(result.current.error).toContain("个人资料补充 FTP");
  expect(api.generate).not.toHaveBeenCalled();
});

test("generates one draft and applies it only after validation and confirmation", async () => {
  api.goals.mockResolvedValueOnce([]).mockResolvedValue([goal]);
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.nextFromBasics();
  });
  await act(async () => {
    result.current.setGoalType("FTP");
    result.current.setTargetWkg("4");
  });
  await act(async () => {
    await result.current.nextFromGoal();
  });
  expect(result.current.error).toBeNull();
  await act(async () => {
    await result.current.nextFromSchedule();
  });
  expect(result.current.stage).toBe("nutrition");
  await act(async () => {
    result.current.setBodyStatus("TIRED");
    result.current.setBodyNote("最近睡眠不足");
    result.current.setCycleWeeks(4);
    result.current.setRestriction("其他限制");
    result.current.setRestrictionNote("对虾过敏");
  });
  await act(async () => {
    await result.current.generate();
  });
  expect(api.generate).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      mode: "initial",
      expectedBaseVersion: 0,
      goalId: goal.id,
      reason: "FATIGUE",
      notes: "当前状态：有些疲劳；计划周期：4 周；最近睡眠不足",
    }),
    expect.any(String),
  );
  expect(api.generate.mock.calls[0]?.[1]).not.toHaveProperty("restriction");
  expect(api.generate.mock.calls[0]?.[1]).not.toHaveProperty("meal");
  expect(result.current.stage).toBe("proposals");
  expect(api.apply).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.validate();
  });
  expect(result.current.confirmOpen).toBe(true);
  expect(api.apply).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.apply();
  });
  expect(api.apply).toHaveBeenCalledWith(
    "token",
    proposal.proposalId,
    0,
    expect.any(String),
  );
  expect(result.current.stage).toBe("success");
  expect(result.current.appliedDates).toEqual([
    proposal.workouts[0].scheduledDate,
  ]);
  expect(result.current.resources?.planStatus).toEqual({
    hasActivePlan: true,
    planVersion: 1,
  });
});

test("an existing plan can generate an empty future week without changing the current plan", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 1 });
  api.goals.mockResolvedValue([goal]);
  api.availability.mockResolvedValue(availability);
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.generateActiveWeek("next");
  });
  expect(api.generate).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({ mode: "empty_week", expectedBaseVersion: 1 }),
    expect.any(String),
  );
  expect(result.current.stage).toBe("proposals");
  expect(api.apply).not.toHaveBeenCalled();
});

test("a recovery task carries its scope and context into the next draft", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 3 });
  api.goals.mockResolvedValue([goal]);
  api.availability.mockResolvedValue(availability);
  calendarApi.getCalendar.mockResolvedValue({
    from: "2030-01-07",
    to: "2030-01-13",
    ftpAvailable: true,
    items: [
      {
        id: "00000000-0000-4000-8000-000000000006",
        planVersion: 3,
        sportType: "cycling",
        source: "ai",
        title: "有氧训练",
        purpose: "建立基础",
        scheduledDate: "2030-01-08",
        dayOrder: 1,
        timeTargetMinutes: 40,
        distanceTargetKm: null,
        segments: [],
      },
    ],
  });
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    result.current.beginTask("RECOVERY");
    result.current.setPlanningScope("THIS_WEEK");
    result.current.setBodyStatus("RECOVERY");
    result.current.setTaskNote("上周完成半马，腿部还有些酸");
  });
  expect(result.current.stage).toBe("planning");
  await act(async () => result.current.submitTask());
  expect(api.adjustPlan).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      mode: "replace_week",
      expectedBaseVersion: 3,
      notes: expect.stringContaining("上周完成半马，腿部还有些酸"),
    }),
    expect.any(String),
  );
  expect(result.current.stage).toBe("proposals");
});

test("an empty current week creates a new week draft instead of failing adjustment", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 4 });
  api.goals.mockResolvedValue([goal]);
  api.availability.mockResolvedValue(availability);
  calendarApi.getCalendar.mockResolvedValue({
    from: "2030-01-07",
    to: "2030-01-13",
    ftpAvailable: true,
    items: [],
  });
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    result.current.beginTask("REPLAN");
    result.current.setPlanningScope("THIS_WEEK");
    await result.current.submitTask();
  });
  expect(api.generate).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      mode: "empty_week",
      expectedBaseVersion: 4,
    }),
    expect.any(String),
  );
  expect(api.adjustPlan).not.toHaveBeenCalled();
  expect(result.current.stage).toBe("proposals");
});

test("only editable future courses use the plan adjustment endpoint", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 6 });
  api.goals.mockResolvedValue([goal]);
  api.availability.mockResolvedValue(availability);
  calendarApi.getCalendar.mockResolvedValue({
    from: "2020-01-06",
    to: "2030-01-13",
    ftpAvailable: true,
    items: [
      {
        id: "00000000-0000-4000-8000-000000000007",
        planVersion: 6,
        sportType: "cycling",
        source: "ai",
        title: "历史课程",
        purpose: "已完成周期",
        scheduledDate: "2020-01-08",
        dayOrder: 1,
        timeTargetMinutes: 40,
        distanceTargetKm: null,
        segments: [],
      },
      {
        id: "00000000-0000-4000-8000-000000000008",
        planVersion: 6,
        sportType: "cycling",
        source: "ai",
        title: "已记录课程",
        purpose: "已有训练记录",
        scheduledDate: "2030-01-08",
        dayOrder: 2,
        timeTargetMinutes: 40,
        distanceTargetKm: null,
        segments: [],
        editable: false,
      },
    ],
  });
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await result.current.generateActiveWeek("current");
  });

  expect(api.generate).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({ mode: "empty_week", expectedBaseVersion: 6 }),
    expect.any(String),
  );
  expect(api.adjustPlan).not.toHaveBeenCalled();
});

test("an empty current week guides missing training data and resumes the same task", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 5 });
  api.goals
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([goal])
    .mockResolvedValue([goal]);
  api.availability
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValue(availability);
  api.readiness
    .mockResolvedValueOnce({
      ready: false,
      missingFields: ["goal", "availability"],
      activePlanVersion: 5,
    })
    .mockResolvedValueOnce({
      ready: false,
      missingFields: ["goal", "availability"],
      activePlanVersion: 5,
    })
    .mockResolvedValueOnce({
      ready: false,
      missingFields: ["availability"],
      activePlanVersion: 5,
    })
    .mockResolvedValue({
      ready: true,
      missingFields: [],
      activePlanVersion: 5,
    });
  calendarApi.getCalendar.mockResolvedValue({
    from: "2030-01-07",
    to: "2030-01-13",
    ftpAvailable: true,
    items: [],
  });
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    result.current.beginTask("REPLAN");
    result.current.setPlanningScope("THIS_WEEK");
    await result.current.submitTask();
  });
  expect(result.current.stage).toBe("goal");
  expect(result.current.task).toBe("REPLAN");
  await act(async () => result.current.nextFromGoal());
  expect(result.current.stage).toBe("schedule");
  await act(async () => result.current.nextFromSchedule());
  expect(result.current.stage).toBe("planning");
  await act(async () => result.current.submitTask());
  expect(api.generate).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      mode: "empty_week",
      expectedBaseVersion: 5,
    }),
    expect.any(String),
  );
  expect(result.current.stage).toBe("proposals");
});

test("nutrition preferences stay local and validate other restrictions before generation", async () => {
  api.goals.mockResolvedValueOnce([]).mockResolvedValue([goal]);
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.nextFromBasics());
  await act(async () => result.current.nextFromGoal());
  await act(async () => result.current.nextFromSchedule());
  expect(result.current.stage).toBe("nutrition");
  await act(async () => result.current.setRestriction("其他限制"));
  await act(async () => result.current.generate());
  expect(result.current.error).toContain("补充其他饮食限制");
  expect(api.generate).not.toHaveBeenCalled();
  await act(async () => result.current.setRestrictionNote("对虾过敏"));
  await act(async () => result.current.generate());
  expect(api.generate).toHaveBeenCalled();
  expect(api.generate.mock.calls[0]?.[1]).not.toHaveProperty("restriction");
  expect(api.generate.mock.calls[0]?.[1]).not.toHaveProperty("restrictionNote");
});

test("an existing week uses the plan adjustment endpoint", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 1 });
  api.goals.mockResolvedValue([goal]);
  api.availability.mockResolvedValue(availability);
  calendarApi.getCalendar.mockResolvedValue({
    from: "2030-01-07",
    to: "2030-01-13",
    ftpAvailable: true,
    items: [
      {
        id: "00000000-0000-4000-8000-000000000006",
        planVersion: 1,
        sportType: "cycling",
        source: "ai",
        title: "有氧训练",
        purpose: "建立基础",
        scheduledDate: "2030-01-08",
        dayOrder: 1,
        timeTargetMinutes: 40,
        distanceTargetKm: null,
        segments: [],
      },
    ],
  });
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.generateActiveWeek("next");
  });
  expect(api.adjustPlan).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({ mode: "replace_week", expectedBaseVersion: 1 }),
    expect.any(String),
  );
  expect(api.generate).not.toHaveBeenCalled();
});

test("an existing plan points the calendar to its next scheduled workout", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 2 });
  calendarApi.getCalendar.mockResolvedValue({
    from: "2026-10-26",
    to: "2026-12-21",
    ftpAvailable: true,
    items: [
      {
        id: "00000000-0000-4000-8000-000000000006",
        planVersion: 2,
        sportType: "cycling",
        source: "ai",
        title: "有氧训练",
        purpose: "建立基础",
        scheduledDate: "2026-11-03",
        dayOrder: 1,
        timeTargetMinutes: 40,
        distanceTargetKm: null,
        segments: [],
      },
    ],
  });
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let date: string | null | undefined;
  await act(async () => {
    date = await result.current.upcomingWorkoutDate();
  });
  expect(date).toBe("2026-11-03");
});

test("an older formal plan without a goal or availability can complete both fields", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 13 });
  api.readiness
    .mockResolvedValueOnce({
      ready: false,
      missingFields: ["goal", "availability"],
      activePlanVersion: 13,
    })
    .mockResolvedValueOnce({
      ready: false,
      missingFields: ["availability"],
      activePlanVersion: 13,
    })
    .mockResolvedValue({
      ready: true,
      missingFields: [],
      activePlanVersion: 13,
    });
  api.goals.mockResolvedValueOnce([]).mockResolvedValue([goal]);
  api.availability
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null)
    .mockResolvedValue(availability);
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.resources?.readiness.missingFields).toEqual([
    "goal",
    "availability",
  ]);
  await act(async () => result.current.goTo("goal"));
  await act(async () => result.current.nextFromGoal());
  expect(result.current.stage).toBe("schedule");
  await act(async () => result.current.nextFromSchedule());
  expect(result.current.stage).toBe("entry");
  expect(result.current.resources?.readiness.ready).toBe(true);
  expect(api.generate).not.toHaveBeenCalled();
});

test("existing plan screen opens the missing goal form instead of trapping the user", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 13 });
  api.readiness.mockResolvedValue({
    ready: false,
    missingFields: ["goal", "availability"],
    activePlanVersion: 13,
  });
  const view = await render(
    <CoachFlowProvider>
      <CoachScreen />
    </CoachFlowProvider>,
  );
  await waitFor(() =>
    expect(view.getByText("训练目标、每周可训练时间")).toBeTruthy(),
  );
  await fireEvent.press(view.getByText("补全训练资料"));
  expect(view.getByText(/确定训练方向与目标日期/)).toBeTruthy();
});

test("existing plan task cards open the planning route without a render loop", async () => {
  api.planStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 4 });
  api.goals.mockResolvedValue([goal]);
  api.availability.mockResolvedValue(availability);
  const view = await render(
    <CoachFlowProvider>
      <CoachScreen />
    </CoachFlowProvider>,
  );
  await waitFor(() => expect(view.getByText("重新规划")).toBeTruthy());
  await act(async () => {
    fireEvent.press(view.getByText("重新规划"));
  });
  await waitFor(() =>
    expect(view.getAllByText("告诉我接下来要怎么变").length).toBeGreaterThan(0),
  );
});

test("a failed AI task keeps the formal plan unchanged and offers a retry state", async () => {
  api.goals.mockResolvedValue([goal]);
  api.availability.mockResolvedValue(availability);
  api.generate.mockResolvedValue({
    generationId: "00000000-0000-4000-8000-000000000005",
    status: "FAILED",
    proposalId: null,
    errorCode: "AI_OUTPUT_INVALID",
    requestId: "request-2",
  });
  const { result } = await renderHook(() => useInitialPlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.generate();
  });
  expect(result.current.stage).toBe("loading");
  expect(result.current.jobStatus).toBe("FAILED");
  expect(result.current.error).toContain("AI_OUTPUT_INVALID");
  expect(result.current.resources?.planStatus.hasActivePlan).toBe(false);
  expect(api.apply).not.toHaveBeenCalled();
});
