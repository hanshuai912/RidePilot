import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { NutritionScreen } from "../screens/NutritionScreen";
import { getProfile } from "../../profile/services/profile.api";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { NutritionApiError, nutritionApi } from "../services/nutrition.api";

jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../services/nutrition.api", () => ({
  NutritionApiError: class NutritionApiError extends Error {
    status: number | null;
    code?: string;
    constructor(message: string, status: number | null, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  nutritionApi: {
    getProfile: jest.fn(),
    saveProfile: jest.fn(),
    getPlan: jest.fn(),
    generate: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
    validate: jest.fn(),
    apply: jest.fn(),
    createMealSwap: jest.fn(),
  },
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, []),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedApi = nutritionApi as jest.Mocked<typeof nutritionApi>;

const plan = {
  planId: null,
  version: 0,
  status: "NOT_GENERATED" as const,
  timezone: "Asia/Shanghai",
  from: "2026-10-29",
  to: "2026-10-29",
  dailyTarget: null,
  items: [],
};

const profile = {
  id: "00000000-0000-0000-0000-000000000010",
  version: 1,
  dietStyle: "OMNIVORE" as const,
  habits: ["HOME_COOKING" as const],
  allergens: [],
  restrictions: [],
  restrictionNote: null,
  commonFoods: [],
  mealSchedule: [{ mealType: "BREAKFAST" as const, localTime: "08:00" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getProfile)
    .mockResolvedValue({ timezone: "Asia/Shanghai" } as Awaited<
      ReturnType<typeof getProfile>
    >);
  mockedUseAuth.mockReturnValue({
    status: "authenticated",
    session: {
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        phone: "13812345678",
        phoneVerified: false,
      },
      accessToken: "access-token",
      expiresAt: Date.now() + 60_000,
    },
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
  });
  mockedApi.getPlan.mockResolvedValue(plan);
});

test("guides a new user to create a nutrition profile", async () => {
  mockedApi.getProfile.mockRejectedValue(new NutritionApiError("未建立", 404));
  const screen = await render(<NutritionScreen />);
  await waitFor(() =>
    expect(screen.getByText("建立你的饮食档案")).toBeTruthy(),
  );
  expect(screen.getByText("填写饮食档案")).toBeTruthy();
  expect(screen.getByText("今天还没有饮食计划")).toBeTruthy();
});

test("shows today's plan entry and profile version", async () => {
  mockedApi.getProfile.mockResolvedValue(profile);
  mockedApi.getPlan.mockResolvedValue({
    ...plan,
    version: 2,
    status: "ACTIVE",
    planId: "00000000-0000-0000-0000-000000000020",
    items: [
      {
        id: "00000000-0000-0000-0000-000000000021",
        localDate: "2026-10-29",
        mealType: "BREAKFAST",
        scheduledLocalTime: "08:00",
        title: "燕麦香蕉早餐",
        foods: [
          {
            name: "燕麦",
            amount: 80,
            unit: "g",
            allergenTags: [],
            ingredientStatus: "KNOWN",
          },
        ],
        nutrients: {
          energyKcal: 520,
          carbohydrateG: 78,
          proteinG: 18,
          fatG: 12,
          fluidMl: null,
          sodiumMg: null,
        },
        nutritionSource: "CURATED",
        confidence: "HIGH",
        linkedWorkoutId: null,
        notes: null,
        warnings: [],
      },
    ],
  });
  const screen = await render(<NutritionScreen />);
  await waitFor(() => expect(screen.getByText("燕麦香蕉早餐")).toBeTruthy());
  expect(screen.getByText("饮食档案已建立")).toBeTruthy();
  expect(screen.getByText(/档案 v/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "替换早餐" })).toBeTruthy();
});

test("keeps an AI result as a draft until the user applies it", async () => {
  mockedApi.getProfile.mockResolvedValue(profile);
  mockedApi.generate.mockResolvedValue({
    generationId: "00000000-0000-0000-0000-000000000030",
    status: "READY",
    proposalId: "00000000-0000-0000-0000-000000000031",
    errorCode: null,
    requestId: "request-1",
  });
  mockedApi.proposal.mockResolvedValue({
    proposalId: "00000000-0000-0000-0000-000000000031",
    proposalType: "AI_PLAN",
    status: "READY",
    baseNutritionVersion: 0,
    proposalVersion: 1,
    original: null,
    draft: {
      startDate: "2026-10-29",
      endDate: "2026-10-29",
      dailyTarget: null,
      items: [
        {
          localDate: "2026-10-29",
          mealType: "BREAKFAST",
          scheduledLocalTime: "08:00",
          title: "香蕉燕麦",
          foods: [
            {
              name: "香蕉",
              amount: 1,
              unit: "piece",
              allergenTags: [],
              ingredientStatus: "KNOWN",
            },
          ],
          nutrients: {
            energyKcal: 300,
            carbohydrateG: 55,
            proteinG: 8,
            fatG: 4,
            fluidMl: null,
            sodiumMg: null,
          },
          nutritionSource: "AI_ESTIMATE",
          confidence: "MEDIUM",
          linkedWorkoutId: null,
          notes: null,
        },
      ],
    },
    validation: { passed: true, warnings: [], blockers: [] },
    metadata: {
      summary: "为今天安排轻量早餐",
      assumptions: ["根据当前饮食档案生成"],
      warnings: [],
      blockers: [],
      sourceRefs: [],
      confidence: "MEDIUM",
      model: "test-model",
      skillVersion: "test",
      skillHash: "test",
    },
  });
  mockedApi.apply.mockResolvedValue({
    success: true,
    newNutritionVersion: 1,
    affectedDates: ["2026-10-29"],
  });
  const screen = await render(<NutritionScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "生成今日营养草稿" }),
    ).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "生成今日营养草稿" }),
  );
  await waitFor(() =>
    expect(screen.getByText("为今天安排轻量早餐")).toBeTruthy(),
  );
  expect(screen.getByText("AI 营养草稿 · 尚未应用")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "确认应用到正式计划" }),
  );
  await waitFor(() =>
    expect(mockedApi.apply).toHaveBeenCalledWith(
      "access-token",
      "00000000-0000-0000-0000-000000000031",
      0,
    ),
  );
});
