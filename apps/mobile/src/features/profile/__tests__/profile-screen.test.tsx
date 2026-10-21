import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { useAuth } from "../../auth/hooks/AuthProvider";
import { ProfileScreen } from "../screens/ProfileScreen";
import { getProfile, patchProfile } from "../services/profile.api";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../services/profile.api", () => ({
  getProfile: jest.fn(),
  patchProfile: jest.fn(),
  ProfileApiError: class ProfileApiError extends Error {},
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockedPatchProfile = patchProfile as jest.MockedFunction<
  typeof patchProfile
>;

const profile = {
  userId: "00000000-0000-0000-0000-000000000001",
  displayName: "骑行者",
  phoneMasked: "138****5678",
  phoneVerificationStatus: "UNVERIFIED" as const,
  gender: null,
  ageBand: null,
  heightCm: null,
  weightKg: null,
  experienceLevel: null,
  trainingPurpose: null,
  equipmentFlags: [],
  viewPreference: "SIMPLE" as const,
  timezone: "Asia/Shanghai",
  locale: "zh-CN",
  version: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    status: "authenticated",
    session: {
      user: { id: profile.userId, phone: "13812345678", phoneVerified: false },
      accessToken: "access",
      expiresAt: Date.now() + 60_000,
    },
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
  });
  mockedGetProfile.mockResolvedValue(profile);
  mockedPatchProfile.mockResolvedValue({
    ...profile,
    displayName: "小明",
    version: 2,
  });
});

test("loads profile and saves the editable display name", async () => {
  const screen = await render(<ProfileScreen />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "账户与页面昵称" })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "账户与页面昵称" }));
  await fireEvent.changeText(
    screen.getByPlaceholderText("未填写时显示骑行者"),
    "小明",
  );
  await fireEvent.press(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() =>
    expect(mockedPatchProfile).toHaveBeenCalledWith(
      "access",
      expect.objectContaining({ displayName: "小明", expectedVersion: 1 }),
    ),
  );
});
