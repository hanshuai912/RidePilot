import * as generationTask from "../services/generation-task";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type {
  NutritionItemDraft,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { TrainingNutritionScreen } from "../screens/TrainingNutritionScreen";
import { NutritionItemEditor } from "../components/NutritionItemEditor";
import { nutritionApi, NutritionApiError } from "../services/nutrition.api";

jest.mock("../../auth/hooks/AuthProvider", () => ({
  useAuth: () => ({ session: { accessToken: "token" } }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ from: "2030-01-01", to: "2030-01-02" }),
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, []),
  router: { back: jest.fn(), canGoBack: () => true },
}));
jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
}));
jest.mock("../services/nutrition.api", () => {
  const actual = jest.requireActual("../services/nutrition.api");
  return {
    NutritionApiError: actual.NutritionApiError,
    nutritionApi: {
      trainingState: jest.fn(),
      getProfile: jest.fn(),
      saveProfile: jest.fn(),
      generate: jest.fn(),
      generation: jest.fn(),
      proposal: jest.fn(),
      update: jest.fn(),
      validate: jest.fn(),
      apply: jest.fn(),
    },
  };
});
const api = jest.mocked(nutritionApi);
const meal: NutritionItemDraft = {
  localDate: "2030-01-01",
  mealType: "BREAKFAST",
  scheduledLocalTime: "08:00",
  title: "米饭早餐",
  foods: [
    {
      name: "米饭",
      amount: 150,
      unit: "g",
      allergenTags: ["SOY"],
      ingredientStatus: "PARTIAL",
    },
  ],
  nutrients: {
    energyKcal: 200,
    carbohydrateG: 40,
    proteinG: 4,
    fatG: 1,
    sodiumMg: null,
    fluidMl: null,
  },
  nutritionSource: "CURATED",
  confidence: "HIGH",
  linkedWorkoutId: null,
  notes: null,
};
const draft: NutritionProposalResponse = {
  proposalId: "00000000-0000-4000-8000-000000000001",
  proposalType: "AI_PLAN",
  status: "READY",
  baseNutritionVersion: 3,
  proposalVersion: 1,
  original: { startDate: "2030-01-01", endDate: "2030-01-02", items: [meal] },
  draft: {
    startDate: "2030-01-01",
    endDate: "2030-01-02",
    items: [{ ...meal, scheduledLocalTime: "09:00" }],
  },
  validation: { passed: true, warnings: [], blockers: [] },
  metadata: null,
};
const state = {
  from: "2030-01-01",
  to: "2030-01-02",
  trainingPlanVersion: 4,
  nutritionVersion: 3,
  affectedDates: ["2030-01-01"],
  generation: null,
  proposal: null,
};
const profile = {
  id: "00000000-0000-4000-8000-000000000002",
  version: 1,
  dietStyle: "OMNIVORE" as const,
  habits: [],
  allergens: [],
  restrictions: [],
  restrictionNote: null,
  commonFoods: [],
  mealSchedule: [{ mealType: "BREAKFAST" as const, localTime: "08:00" }],
};
beforeEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
  api.trainingState.mockResolvedValue(state);
  api.getProfile.mockResolvedValue(profile);
});

test("reads affected dates without generating and generates only after a click", async () => {
  const view = await render(<TrainingNutritionScreen />);
  await waitFor(() =>
    expect(view.getByText("待核对日期：2030-01-01")).toBeTruthy(),
  );
  expect(api.generate).not.toHaveBeenCalled();
  api.generate.mockResolvedValue({
    generationId: "job",
    status: "READY",
    proposalId: draft.proposalId,
    errorCode: null,
    requestId: null,
  });
  api.proposal.mockResolvedValue(draft);
  await fireEvent.press(view.getByText("生成训练补给草稿"));
  await waitFor(() =>
    expect(view.getByText("确认应用到正式计划")).toBeTruthy(),
  );
  expect(api.generate).toHaveBeenCalledTimes(1);
  expect(api.generate).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      mode: "TRAINING_LINKED",
      expectedTrainingPlanVersion: 4,
      expectedNutritionVersion: 3,
    }),
  );
  expect(api.apply).not.toHaveBeenCalled();
  expect(view.queryByText("米饭早餐", { exact: true })).toBeNull();
  await fireEvent.press(
    view.getByRole("button", { name: "查看 2030-01-01 原安排" }),
  );
  expect(view.getByText(/08:00 · 早餐/)).toBeTruthy();
  expect(view.getByText("建议安排")).toBeTruthy();
});

test("restores an existing draft and requires separate nutrition confirmation", async () => {
  api.trainingState.mockResolvedValue({ ...state, proposal: draft } as never);
  const view = await render(<TrainingNutritionScreen />);
  await waitFor(() =>
    expect(view.getByText("确认应用到正式计划")).toBeTruthy(),
  );
  expect(api.generate).not.toHaveBeenCalled();
  api.apply.mockResolvedValue({
    success: true,
    newNutritionVersion: 4,
    affectedDates: ["2030-01-01"],
  });
  api.trainingState.mockResolvedValue({
    ...state,
    nutritionVersion: 4,
    affectedDates: [],
    proposal: { ...draft, status: "APPLIED" },
  } as never);
  await fireEvent.press(view.getByText("确认应用到正式计划"));
  await waitFor(() =>
    expect(view.getByText("AI 营养方案 · 已应用")).toBeTruthy(),
  );
  expect(api.apply).toHaveBeenCalledWith("token", draft.proposalId, 3);
  expect(api.generate).not.toHaveBeenCalled();
});

test("restores an applied plan without regeneration and regenerates explicitly", async () => {
  api.trainingState.mockResolvedValue({
    ...state,
    affectedDates: [],
    proposal: { ...draft, status: "APPLIED" },
  } as never);
  const view = await render(<TrainingNutritionScreen />);
  await waitFor(() =>
    expect(view.getByText("AI 营养方案 · 已应用")).toBeTruthy(),
  );
  expect(api.generate).not.toHaveBeenCalled();
  api.generate.mockResolvedValue({
    generationId: "job",
    status: "READY",
    proposalId: draft.proposalId,
    errorCode: null,
    requestId: null,
  });
  api.proposal.mockResolvedValue(draft);
  await fireEvent.press(view.getByText("重新生成训练补给草稿"));
  await waitFor(() =>
    expect(api.generate).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ forceRegenerate: true }),
    ),
  );
});

test("profile completion stays on the page and still needs an explicit generate click", async () => {
  api.getProfile.mockRejectedValue(new NutritionApiError("请填写", 404));
  api.saveProfile.mockResolvedValue(profile);
  const view = await render(<TrainingNutritionScreen />);
  await waitFor(() => expect(view.getByText("填写饮食档案")).toBeTruthy());
  await fireEvent.press(view.getByText("填写饮食档案"));
  await fireEvent.press(view.getByText("保存饮食档案"));
  await waitFor(() => expect(api.saveProfile).toHaveBeenCalled());
  expect(api.generate).not.toHaveBeenCalled();
});

test("failed generation leaves a retryable page and preserves official nutrition", async () => {
  api.generate.mockRejectedValue(new Error("训练计划已更新，请重新生成"));
  const view = await render(<TrainingNutritionScreen />);
  await waitFor(() => expect(view.getByText("生成训练补给草稿")).toBeTruthy());
  await fireEvent.press(view.getByText("生成训练补给草稿"));
  await waitFor(() =>
    expect(view.getByText("训练计划已更新，请重新生成")).toBeTruthy(),
  );
  expect(view.getByText("刷新并继续查询")).toBeTruthy();
  expect(view.getByText("生成训练补给草稿")).toBeTruthy();
  expect(api.apply).not.toHaveBeenCalled();
});

test("quantity editing retains ingredient provenance and invalidates old nutrients", async () => {
  const save = jest.fn().mockResolvedValue(true);
  const close = jest.fn();
  const view = await render(
    <NutritionItemEditor
      item={meal}
      busy={false}
      onSave={save}
      onClose={close}
    />,
  );
  await fireEvent.changeText(view.getByLabelText("米饭份量"), "90");
  await fireEvent.changeText(view.getByLabelText("用餐时间"), "09:30");
  await fireEvent.press(view.getByText("保存为草稿"));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledLocalTime: "09:30",
        foods: [{ ...meal.foods[0], amount: 90 }],
        nutrients: expect.objectContaining({
          energyKcal: null,
          carbohydrateG: null,
        }),
        confidence: "LOW",
      }),
    ),
  );
  expect(close).toHaveBeenCalled();
});

test("invalid amounts and times cannot save", async () => {
  const save = jest.fn();
  const view = await render(
    <NutritionItemEditor
      item={meal}
      busy={false}
      onSave={save}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.changeText(view.getByLabelText("用餐时间"), "25:70");
  await fireEvent.changeText(view.getByLabelText("米饭份量"), "0");
  await fireEvent.press(view.getByText("保存为草稿"));
  await waitFor(() =>
    expect(
      view.getByText("请输入有效时间（HH:mm）及大于 0、不超过 10000 的份量"),
    ).toBeTruthy(),
  );
  expect(save).not.toHaveBeenCalled();
});

test("a rejected quantity save shows its error in the modal, retains input and can retry", async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error("网络中断，请重试"))
    .mockResolvedValueOnce(true);
  const close = jest.fn();
  const view = await render(
    <NutritionItemEditor
      item={meal}
      busy={false}
      onSave={save}
      onClose={close}
    />,
  );
  await fireEvent.changeText(view.getByLabelText("米饭份量"), "170");
  await fireEvent.press(view.getByText("保存为草稿"));
  await view.findByText("网络中断，请重试");
  expect(view.getByLabelText("米饭份量").props.value).toBe("170");
  expect(close).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText("保存为草稿"));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[1][0].foods[0].amount).toBe(170);
});

test("a timed out poll can resume the existing task without generating again", async () => {
  const poll = jest.spyOn(generationTask, "waitForNutritionProposal");
  poll.mockRejectedValueOnce(new Error("生成等待超时，请重试"));
  const view = await render(<TrainingNutritionScreen />);
  await waitFor(() => expect(view.getByText("生成训练补给草稿")).toBeTruthy());
  const queued = {
    generationId: "job",
    status: "QUEUED" as const,
    proposalId: null,
    errorCode: null,
    requestId: null,
  };
  api.generate.mockResolvedValue(queued);
  await fireEvent.press(view.getByText("生成训练补给草稿"));
  await waitFor(() =>
    expect(view.getByText("生成等待超时，请重试")).toBeTruthy(),
  );
  api.trainingState.mockResolvedValue({
    ...state,
    generation: queued,
  } as never);
  poll.mockResolvedValueOnce(draft);
  await fireEvent.press(view.getByText("刷新并继续查询"));
  await waitFor(() =>
    expect(view.getByText("确认应用到正式计划")).toBeTruthy(),
  );
  expect(api.generate).toHaveBeenCalledTimes(1);
  expect(api.apply).not.toHaveBeenCalled();
});
