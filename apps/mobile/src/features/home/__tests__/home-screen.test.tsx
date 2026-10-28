import { render, waitFor } from "@testing-library/react-native";

import { HomeScreen } from "../screens/HomeScreen";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile } from "../../profile/services/profile.api";
import { coachApi } from "../../coach/services/coach.api";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
}));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: { planStatus: jest.fn() },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, []),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockedPlanStatus = coachApi.planStatus as jest.MockedFunction<
  typeof coachApi.planStatus
>;

beforeEach(() => {
  jest.clearAllMocks();
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
  mockedPlanStatus.mockResolvedValue({ hasActivePlan: false, planVersion: 0 });
});

test("loads the profile name and keeps unavailable home data out of the page", async () => {
  mockedGetProfile.mockResolvedValue({
    userId: "00000000-0000-0000-0000-000000000001",
    displayName: "小明",
    phoneMasked: "138****5678",
    phoneVerificationStatus: "UNVERIFIED",
    gender: null,
    ageBand: null,
    heightCm: null,
    weightKg: null,
    experienceLevel: null,
    trainingPurpose: null,
    equipmentFlags: [],
    viewPreference: "SIMPLE",
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    version: 1,
  });

  const screen = await render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText(/小明 ·/)).toBeTruthy());
  expect(screen.getByText("尚无正式训练计划")).toBeTruthy();
  expect(screen.getByText("身体状态")).toBeTruthy();
  expect(screen.queryByText("60 分钟耐力骑行")).toBeNull();
  expect(screen.queryByText("今日饮食")).toBeNull();
  expect(mockedGetProfile).toHaveBeenCalledWith("access-token");
});

test("shows the active plan after the status endpoint reports an applied version", async () => {
  mockedGetProfile.mockResolvedValue({
    userId: "00000000-0000-0000-0000-000000000001",
    displayName: "骑行者",
    phoneMasked: "138****5678",
    phoneVerificationStatus: "UNVERIFIED",
    gender: null,
    ageBand: null,
    heightCm: null,
    weightKg: null,
    experienceLevel: "BEGINNER",
    trainingPurpose: null,
    equipmentFlags: [],
    viewPreference: "SIMPLE",
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    version: 1,
  });
  mockedPlanStatus.mockResolvedValue({ hasActivePlan: true, planVersion: 1 });
  const screen = await render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText("训练计划已生效")).toBeTruthy());
  expect(screen.queryByText("尚无正式训练计划")).toBeNull();
});
