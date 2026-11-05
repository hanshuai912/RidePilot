import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { router, Stack } from "expo-router";
import type { ProfileResponse } from "@ridepilot/contracts";
import { Button } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile, patchProfile } from "../../profile/services/profile.api";
import { coachApi } from "../../coach/services/coach.api";
import { RaceProposalScreen } from "../screens/RaceProposalScreen";
import { RaceTrainingSetupScreen } from "../screens/RaceTrainingSetupScreen";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
  patchProfile: jest.fn(),
}));
jest.mock("../../coach/services/coach.api", () => ({
  CoachApiError: jest.requireActual("../../coach/services/coach.api")
    .CoachApiError,
  coachApi: Object.fromEntries(
    [
      "race",
      "raceTrainingState",
      "raceImpact",
      "goals",
      "planStatus",
      "readiness",
      "ftp",
      "availability",
      "saveAvailability",
      "createGoal",
      "updateGoal",
      "replanRace",
      "generation",
      "proposal",
      "apply",
      "validate",
    ].map((name) => [name, jest.fn()]),
  ),
}));
jest.mock("../../coach/components/PlanPreview", () => ({
  PlanPreview: () => {
    const { Text } = jest.requireActual("react-native");
    return <Text>本赛事备赛计划预览</Text>;
  },
}));

const api = jest.mocked(coachApi);
const raceId = "00000000-0000-4000-8000-000000000001";
let profile: ProfileResponse;
let ftp: Awaited<ReturnType<typeof coachApi.ftp>>;
let goals: Awaited<ReturnType<typeof coachApi.goals>>;
let availability: Awaited<ReturnType<typeof coachApi.availability>>;

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  "races/proposal": RaceProposalScreen,
  "races/training-setup": RaceTrainingSetupScreen,
  "cycling-power-zones": () => (
    <Button
      onPress={() => {
        ftp = {
          id: "ftp",
          valueWatts: 200,
          measuredAt: "2026-11-04T00:00:00Z",
          source: "MANUAL",
        };
        router.back();
      }}
    >
      保存 FTP 并返回
    </Button>
  ),
};

beforeEach(() => {
  jest.resetAllMocks();
  profile = {
    userId: "owner",
    displayName: "骑行者",
    phoneMasked: "138****5678",
    phoneVerificationStatus: "UNVERIFIED",
    gender: null,
    birthDate: null,
    heightCm: 170,
    weightKg: 60,
    experienceLevel: null,
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    version: 1,
  };
  ftp = null;
  goals = [];
  availability = null;
  jest
    .mocked(useAuth)
    .mockReturnValue({ session: { accessToken: "token" } } as ReturnType<
      typeof useAuth
    >);
  jest.mocked(getProfile).mockImplementation(async () => profile);
  jest.mocked(patchProfile).mockImplementation(async (_token, input) => {
    profile = {
      ...profile,
      experienceLevel: input.experienceLevel ?? profile.experienceLevel,
      version: profile.version + 1,
    };
    return profile;
  });
  api.ftp.mockImplementation(async () => ftp);
  api.goals.mockImplementation(async () => goals);
  api.availability.mockImplementation(async () => availability);
  api.planStatus.mockResolvedValue({ hasActivePlan: false, planVersion: 0 });
  api.readiness.mockImplementation(async () => {
    const missingFields: Awaited<
      ReturnType<typeof coachApi.readiness>
    >["missingFields"] = [];
    if (!ftp) missingFields.push("ftp");
    if (!profile.experienceLevel) missingFields.push("experienceLevel");
    if (!goals.length) missingFields.push("goal");
    if (!availability) missingFields.push("availability");
    return {
      ready: !missingFields.length,
      missingFields,
      activePlanVersion: 0,
    };
  });
  api.createGoal.mockImplementation(async (_token, input) => {
    const goal = {
      ...input,
      id: "goal",
      status: "ACTIVE" as const,
      version: 1,
    };
    goals = [goal];
    return goal;
  });
  api.saveAvailability.mockImplementation(async (_token, input) => {
    availability = {
      timezone: input.timezone,
      weekdays: input.weekdays,
      maxSessionMinutes: input.maxSessionMinutes,
      version: 1,
    };
    return availability;
  });
  api.race.mockResolvedValue({ id: raceId, localDate: "2030-06-09" } as Awaited<
    ReturnType<typeof coachApi.race>
  >);
  api.raceTrainingState.mockResolvedValue({
    phase: "PREPARATION",
    today: "2030-06-03",
    startDate: "2030-06-03",
    endDate: "2030-06-16",
    generation: null,
    proposal: null,
    message: null,
  });
  api.raceImpact.mockResolvedValue({
    conflicts: [],
    workouts: [],
    stages: [],
    messages: [],
  } as unknown as Awaited<ReturnType<typeof coachApi.raceImpact>>);
  api.replanRace.mockResolvedValue({
    generationId: "job",
    status: "READY",
    proposalId: "draft",
    errorCode: null,
    requestId: null,
  });
  api.proposal.mockResolvedValue({
    proposalId: "draft",
    status: "READY",
    basePlanVersion: 0,
    blockers: [],
    proposalVersion: 1,
    scene: "RACE_REPLAN",
    replaceWorkoutIds: [],
    weekStartDate: "2030-06-03",
    summary: "备赛计划",
    stageSummary: "减量",
    assessmentSuggestion: "赛后复评",
    workouts: [],
    warnings: [],
    skillVersion: "1",
    model: "test",
  });
});

test("补填 FTP、经验、目标和时间后回到同一赛事生成首份备赛草稿", async () => {
  await renderRouter(routes, {
    initialUrl: `/races/proposal?raceId=${raceId}&recovery=1`,
  });
  await waitFor(() => expect(screen.getByText("去填写基本信息")).toBeTruthy());
  await fireEvent.press(screen.getByText("去填写基本信息"));
  await waitFor(() =>
    expect(screen.getByText("到个人资料补充 FTP")).toBeTruthy(),
  );
  expect(api.replanRace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("到个人资料补充 FTP"));
  await fireEvent.press(await screen.findByText("保存 FTP 并返回"));
  await waitFor(() => expect(screen.getByText("200 W")).toBeTruthy());
  await fireEvent.press(screen.getByText("规律骑行"));
  await fireEvent.press(screen.getByText("保存并继续"));
  await waitFor(() => expect(screen.getByText("准备一场比赛")).toBeTruthy());
  await fireEvent.press(screen.getByText("准备一场比赛"));
  await fireEvent.press(screen.getByText("保存并继续"));
  await waitFor(() => expect(screen.getByText("每周可训练日")).toBeTruthy());
  await fireEvent.press(screen.getByText("保存并继续"));
  await waitFor(() => expect(screen.getByText("返回备赛计划")).toBeTruthy());
  expect(api.replanRace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("返回备赛计划"));
  await waitFor(() =>
    expect(screen.getByText("生成备赛计划草稿")).toBeTruthy(),
  );
  expect(api.replanRace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("生成备赛计划草稿"));
  await waitFor(() =>
    expect(screen.getByText("本赛事备赛计划预览")).toBeTruthy(),
  );
  expect(api.replanRace).toHaveBeenCalledWith(
    "token",
    raceId,
    expect.objectContaining({
      goalId: "goal",
      weekStartDate: "2030-06-03",
      expectedBaseVersion: 0,
      notes: expect.stringContaining("赛后恢复"),
    }),
    expect.any(String),
  );
  expect(api.apply).not.toHaveBeenCalled();
});

test("保存资料失败时保留表单并允许重试", async () => {
  profile.experienceLevel = "INTERMEDIATE";
  ftp = {
    id: "ftp",
    valueWatts: 200,
    measuredAt: "2026-11-04T00:00:00Z",
    source: "MANUAL",
  };
  goals = [
    {
      id: "goal",
      type: "RACE",
      description: null,
      targetWkg: null,
      targetDate: "2030-06-09",
      priority: "PRIMARY",
      status: "ACTIVE",
      version: 1,
    },
  ];
  api.saveAvailability.mockRejectedValueOnce(new Error("保存失败，请重试"));
  await renderRouter(routes, {
    initialUrl: `/races/training-setup?raceId=${raceId}`,
  });
  await waitFor(() => expect(screen.getByText("每周可训练日")).toBeTruthy());
  await fireEvent.press(screen.getByText("保存并继续"));
  await waitFor(() =>
    expect(screen.getByText("保存失败，请重试")).toBeTruthy(),
  );
  expect(screen.getByText("每周可训练日")).toBeTruthy();
  expect(api.replanRace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("保存并继续"));
  await waitFor(() => expect(screen.getByText("返回备赛计划")).toBeTruthy());
});
