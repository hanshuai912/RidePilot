import { act, renderHook } from "@testing-library/react-native";
import type { NutritionProfileResponse } from "@ridepilot/contracts";
import { defaultNutritionProfile } from "../../nutrition/model/nutrition";
import {
  NutritionApiError,
  nutritionApi,
} from "../../nutrition/services/nutrition.api";
import { useInitialPlanNutrition } from "../hooks/useInitialPlanNutrition";

jest.mock("../../nutrition/services/nutrition.api", () => ({
  ...jest.requireActual("../../nutrition/services/nutrition.api"),
  nutritionApi: { getProfile: jest.fn(), saveProfile: jest.fn() },
}));
const food = jest.mocked(nutritionApi);
const saved: NutritionProfileResponse = {
  ...defaultNutritionProfile,
  id: "00000000-0000-4000-8000-000000000099",
  version: 3,
  dietStyle: "PESCATARIAN",
  allergens: ["PEANUT", "MILK"],
  restrictions: ["NO_PORK", "LOW_LACTOSE"],
  habits: ["EATING_OUT", "LIMITED_PREP_TIME"],
  restrictionNote: "避免辛辣",
  commonFoods: ["米饭", "豆腐"],
  mealSchedule: [
    { mealType: "BREAKFAST", localTime: "07:15" },
    { mealType: "SNACK", localTime: "16:30" },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
  food.getProfile.mockResolvedValue(saved);
  food.saveProfile.mockImplementation(
    async (_token, { expectedVersion, ...input }) => ({
      ...input,
      id: saved.id,
      version: (expectedVersion ?? 0) + 1,
    }),
  );
});

async function loadedHook() {
  const view = await renderHook(() => useInitialPlanNutrition("token"));
  await act(async () => view.result.current.load());
  return view;
}

test("reads the real profile lazily and preserves all fields and its version", async () => {
  const { result } = await renderHook(() => useInitialPlanNutrition("token"));
  expect(food.getProfile).not.toHaveBeenCalled();
  await act(async () => result.current.load());
  expect(result.current.form).toEqual(
    expect.objectContaining({
      dietStyle: "PESCATARIAN",
      allergens: saved.allergens,
      habits: saved.habits,
      restrictions: saved.restrictions,
      commonFoods: saved.commonFoods,
      mealSchedule: saved.mealSchedule,
      expectedVersion: 3,
    }),
  );
  expect(result.current.form).not.toHaveProperty("id");
  expect(result.current.dirty).toBe(false);
  await act(async () => result.current.save());
  expect(food.saveProfile).not.toHaveBeenCalled();
});

test("keeps edits when the wizard returns to this page", async () => {
  const { result } = await loadedHook();
  await act(async () =>
    result.current.setForm((current) => ({ ...current, dietStyle: "VEGAN" })),
  );
  await act(async () => result.current.load());
  expect(food.getProfile).toHaveBeenCalledTimes(1);
  expect(result.current.form.dietStyle).toBe("VEGAN");
});

test("creates a missing profile only after an explicit 404 and save", async () => {
  food.getProfile.mockRejectedValue(new NutritionApiError("未建立", 404));
  const { result } = await loadedHook();
  expect(result.current.loaded).toBe(true);
  expect(result.current.profile).toBeNull();
  expect(food.saveProfile).not.toHaveBeenCalled();
  await act(async () => result.current.save());
  expect(food.saveProfile).toHaveBeenCalledWith(
    "token",
    expect.objectContaining(defaultNutritionProfile),
  );
  expect(food.saveProfile.mock.calls[0][1].expectedVersion).toBeUndefined();
  expect(result.current.profile?.version).toBe(1);
});

test.each([401, 403, 500, null])(
  "failed read (%s) never replaces server data with defaults",
  async (status) => {
    food.getProfile.mockRejectedValue(
      new NutritionApiError("读取失败", status),
    );
    const { result } = await loadedHook();
    expect(result.current.loaded).toBe(false);
    await act(async () => result.current.save());
    expect(food.saveProfile).not.toHaveBeenCalled();
    food.getProfile.mockResolvedValue(saved);
    await act(async () => result.current.load());
    expect(result.current.form.allergens).toEqual(["PEANUT", "MILK"]);
  },
);

test("updates use the read version and retain foods, times, and multiple restrictions", async () => {
  const { result } = await loadedHook();
  await act(async () =>
    result.current.setForm((current) => ({
      ...current,
      allergens: [...current.allergens, "SOY"],
    })),
  );
  await act(async () => result.current.save());
  expect(food.saveProfile).toHaveBeenCalledWith(
    "token",
    expect.objectContaining({
      expectedVersion: 3,
      allergens: ["PEANUT", "MILK", "SOY"],
      mealSchedule: saved.mealSchedule,
      commonFoods: saved.commonFoods,
      restrictions: saved.restrictions,
    }),
  );
  expect(result.current.profile?.version).toBe(4);
  await act(async () => result.current.save());
  expect(food.saveProfile).toHaveBeenCalledTimes(1);
});

test("a version conflict keeps edited values and requires explicit reload", async () => {
  food.saveProfile.mockRejectedValue(new NutritionApiError("版本冲突", 409));
  const { result } = await loadedHook();
  await act(async () =>
    result.current.setForm((current) => ({
      ...current,
      restrictionNote: "本页修改",
    })),
  );
  await act(async () => result.current.save());
  expect(result.current.form.restrictionNote).toBe("本页修改");
  expect(result.current.conflict).toBe(true);
  await act(async () => result.current.save());
  expect(food.saveProfile).toHaveBeenCalledTimes(1);
  food.getProfile.mockResolvedValue({
    ...saved,
    version: 4,
    restrictionNote: "另一端修改",
  });
  await act(async () => result.current.load(true));
  expect(result.current.form.restrictionNote).toBe("另一端修改");
  expect(result.current.form.expectedVersion).toBe(4);
  expect(result.current.conflict).toBe(false);
});

test("failed save retains inputs and allows a deliberate retry", async () => {
  food.saveProfile.mockRejectedValueOnce(
    new NutritionApiError("服务器暂不可用", 503),
  );
  const { result } = await loadedHook();
  await act(async () =>
    result.current.setForm((current) => ({
      ...current,
      restrictionNote: "保留输入",
    })),
  );
  await act(async () => expect(await result.current.save()).toBe(false));
  expect(result.current.form.restrictionNote).toBe("保留输入");
  expect(result.current.saving).toBe(false);
  await act(async () => expect(await result.current.save()).toBe(true));
  expect(result.current.profile?.restrictionNote).toBe("保留输入");
});

test("reconciles a timed-out successful save without submitting it twice", async () => {
  const { result } = await loadedHook();
  await act(async () =>
    result.current.setForm((current) => ({ ...current, dietStyle: "VEGAN" })),
  );
  food.saveProfile.mockRejectedValue(new NutritionApiError("连接超时", null));
  food.getProfile.mockResolvedValue({
    ...saved,
    version: 4,
    dietStyle: "VEGAN",
  });
  await act(async () => expect(await result.current.save()).toBe(true));
  expect(result.current.profile?.version).toBe(4);
  await act(async () => result.current.save());
  expect(food.saveProfile).toHaveBeenCalledTimes(1);
});

test("invalid times and too many foods are rejected before a server write", async () => {
  const { result } = await loadedHook();
  await act(async () =>
    result.current.setForm((current) => ({
      ...current,
      mealSchedule: [{ mealType: "BREAKFAST", localTime: "25:00" }],
    })),
  );
  await act(async () => result.current.save());
  expect(result.current.error).toContain("HH:mm");
  await act(async () =>
    result.current.setForm((current) => ({
      ...current,
      mealSchedule: saved.mealSchedule,
      commonFoods: Array.from({ length: 31 }, (_, i) => `食物${i}`),
    })),
  );
  await act(async () => result.current.save());
  expect(result.current.error).toContain("最多 30 项");
  expect(food.saveProfile).not.toHaveBeenCalled();
});
