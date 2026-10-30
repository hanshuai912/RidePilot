import { Text } from "react-native";
import { Stack, router, usePathname } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library";
import { PersonalInformationScreen } from "../screens/PersonalInformationScreen";

import { useAuth } from "../../auth/hooks/AuthProvider";
import { ProfileScreen } from "../screens/ProfileScreen";
import {
  getProfile,
  patchProfile,
  ProfileApiError,
} from "../services/profile.api";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../services/profile.api", () => ({
  ...jest.requireActual("../services/profile.api"),
  getProfile: jest.fn(),
  patchProfile: jest.fn(),
}));
jest.mock("../../integrations/components/CorosConnectionCard", () => ({
  CorosConnectionCard: () => null,
}));
jest.mock("../components/FtpMeasurementCard", () => ({
  FtpMeasurementCard: () => null,
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
  birthDate: null,
  heightCm: null,
  weightKg: null,
  experienceLevel: null,
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

async function openEditor() {
  await renderRouter(
    {
      _layout: function ProfileTestLayout() {
        return (
          <>
            <Text testID="profile-route">{usePathname()}</Text>
            <Stack screenOptions={{ headerShown: false }} />
          </>
        );
      },
      profile: ProfileScreen,
      "personal-info": PersonalInformationScreen,
    },
    { initialUrl: "/profile" },
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "个人信息" })).toBeTruthy(),
  );
  expect(screen.queryByText("账户与页面昵称")).toBeNull();
  expect(screen.queryByText("身体与能力")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "个人信息" }));
  await waitFor(() =>
    expect(screen.getByTestId("profile-route")).toHaveTextContent(
      "/personal-info",
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "保存资料" })).toBeTruthy(),
  );
}

async function rename(name = "小明") {
  await fireEvent.changeText(screen.getByLabelText("页面昵称"), name);
}

test("the profile card opens personal information; only changed fields enable saving", async () => {
  await openEditor();
  expect(screen.getByRole("header", { name: "个人信息" })).toBeTruthy();
  expect(screen.queryByText("编辑个人资料")).toBeNull();
  expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "保存资料" }));
  expect(mockedPatchProfile).not.toHaveBeenCalled();
  await rename();
  expect(screen.getByRole("button", { name: "保存资料" })).toBeEnabled();
  await rename("");
  expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled();
  await rename();
  mockedGetProfile.mockResolvedValue({
    ...profile,
    displayName: "小明",
    version: 2,
  });
  await fireEvent.press(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() =>
    expect(screen.getByTestId("profile-route")).toHaveTextContent("/profile"),
  );
  expect(mockedPatchProfile).toHaveBeenCalledWith(
    "access",
    expect.objectContaining({ displayName: "小明", expectedVersion: 1 }),
  );
  await waitFor(() => expect(screen.getByText("小明")).toBeTruthy());
  expect(screen.queryByText("有未保存的修改")).toBeNull();
});

test("personal information keeps the six personal fields and the date drawer", async () => {
  mockedGetProfile.mockResolvedValue({ ...profile, birthDate: "1990-01-15" });
  await openEditor();
  expect(screen.queryByText("训练时区")).toBeNull();
  expect(screen.queryByText("课程显示偏好")).toBeNull();
  expect(screen.queryByText("训练意向")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  await fireEvent.press(screen.getByRole("radio", { name: "16日" }));
  await fireEvent.press(screen.getByRole("button", { name: "确认日期" }));
  await fireEvent.press(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() =>
    expect(mockedPatchProfile).toHaveBeenCalledWith(
      "access",
      expect.objectContaining({ birthDate: "1990-01-16", expectedVersion: 1 }),
    ),
  );
});

test("back with no edits leaves immediately", async () => {
  await openEditor();
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  await waitFor(() =>
    expect(screen.getByTestId("profile-route")).toHaveTextContent("/profile"),
  );
  expect(screen.queryByText("有未保存的修改")).toBeNull();
});

test.each(["header", "system"])(
  "%s back asks before discarding; continuing preserves input",
  async (method) => {
    await openEditor();
    await rename();
    if (method === "header")
      await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
    else await act(() => router.back());
    await waitFor(() =>
      expect(screen.getByText("有未保存的修改")).toBeTruthy(),
    );
    expect(screen.getByTestId("profile-route")).toHaveTextContent(
      "/personal-info",
    );
    await fireEvent.press(screen.getByRole("button", { name: "继续编辑" }));
    expect(screen.getByLabelText("页面昵称")).toHaveDisplayValue("小明");
    await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
    await fireEvent.press(screen.getByRole("button", { name: "放弃修改" }));
    await waitFor(() =>
      expect(screen.getByTestId("profile-route")).toHaveTextContent("/profile"),
    );
    expect(mockedPatchProfile).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "个人信息" }));
    await waitFor(() =>
      expect(screen.getByLabelText("页面昵称")).toHaveDisplayValue(""),
    );
    expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled();
  },
);

test("a failed save retains the draft and unsaved back protection", async () => {
  mockedPatchProfile.mockRejectedValueOnce(new Error("网络不可用，请重试"));
  await openEditor();
  await rename();
  await fireEvent.press(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() =>
    expect(screen.getByText("网络不可用，请重试")).toBeTruthy(),
  );
  expect(screen.getByLabelText("页面昵称")).toHaveDisplayValue("小明");
  expect(screen.getByRole("button", { name: "保存资料" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  expect(screen.getByText("有未保存的修改")).toBeTruthy();
});

test("invalid input stays editable and never calls the API", async () => {
  await openEditor();
  await fireEvent.changeText(screen.getByLabelText("身高（cm）"), ".");
  await fireEvent.press(screen.getByRole("button", { name: "保存资料" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/请检查输入/);
  expect(mockedPatchProfile).not.toHaveBeenCalled();
});

test("each personal field enables saving and returning to the original value disables it", async () => {
  mockedGetProfile.mockResolvedValue({
    ...profile,
    heightCm: 170,
    weightKg: 65,
    gender: "MALE",
    experienceLevel: "BEGINNER",
  });
  await openEditor();
  for (const [label, changed, original] of [
    ["身高（cm）", "175", "170"],
    ["体重（kg）", "66", "65"],
  ]) {
    await fireEvent.changeText(screen.getByLabelText(label), changed);
    expect(screen.getByRole("button", { name: "保存资料" })).toBeEnabled();
    await fireEvent.changeText(screen.getByLabelText(label), original);
    expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled();
  }
  for (const [changed, original] of [
    ["女性", "男性"],
    ["进阶", "入门"],
  ]) {
    await fireEvent.press(screen.getByRole("radio", { name: changed }));
    expect(screen.getByRole("button", { name: "保存资料" })).toBeEnabled();
    await fireEvent.press(screen.getByRole("radio", { name: original }));
    expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled();
  }
});

test("saving blocks duplicate writes and leaving until the request completes", async () => {
  let finish!: (value: typeof profile) => void;
  mockedPatchProfile.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await openEditor();
  await rename();
  await fireEvent.press(screen.getByRole("button", { name: "保存资料" }));
  expect(screen.getByLabelText("页面昵称")).toHaveProp("editable", false);
  expect(screen.getByRole("button", { name: "返回我的" })).toBeDisabled();
  await act(() => router.back());
  expect(screen.getByTestId("profile-route")).toHaveTextContent(
    "/personal-info",
  );
  expect(mockedPatchProfile).toHaveBeenCalledTimes(1);
  await act(() => finish({ ...profile, version: 2 }));
  await waitFor(() =>
    expect(screen.getByTestId("profile-route")).toHaveTextContent("/profile"),
  );
});

test("version conflicts keep the edited values visible", async () => {
  mockedPatchProfile.mockRejectedValueOnce(
    new ProfileApiError("conflict", 409),
  );
  await openEditor();
  await rename();
  await fireEvent.press(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/资料已在其他设备更新/),
  );
  expect(screen.getByLabelText("页面昵称")).toHaveDisplayValue("小明");
});

test("a failed initial load offers retry and does not expose a blank editable form", async () => {
  mockedGetProfile
    .mockResolvedValueOnce(profile)
    .mockRejectedValueOnce(new Error("个人信息加载失败"));
  await renderRouter(
    {
      _layout: function ProfileTestLayout() {
        return <Stack screenOptions={{ headerShown: false }} />;
      },
      profile: ProfileScreen,
      "personal-info": PersonalInformationScreen,
    },
    { initialUrl: "/profile" },
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "个人信息" })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "个人信息" }));
  await waitFor(() =>
    expect(screen.getByText("个人信息加载失败")).toBeTruthy(),
  );
  expect(screen.queryByRole("button", { name: "保存资料" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "重新加载" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled(),
  );
});
