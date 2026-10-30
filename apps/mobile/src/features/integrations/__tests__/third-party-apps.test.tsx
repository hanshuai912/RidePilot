import { Alert, Text } from "react-native";
import { Stack, router, usePathname } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
  within,
} from "expo-router/testing-library";
import CorosCallbackRoute from "../../../../app/coros-callback";
import ThirdPartyAppsRoute from "../../../../app/third-party-apps";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { ProfileScreen } from "../../profile/screens/ProfileScreen";
import { getProfile } from "../../profile/services/profile.api";
import { coachApi } from "../../coach/services/coach.api";
import { heartRateApi } from "../../profile/services/heart-rate.api";
import {
  listConnections,
  startCorosAuthorization,
} from "../services/integrations.api";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
}));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: { ftp: jest.fn() },
}));
jest.mock("../../profile/services/heart-rate.api", () => ({
  heartRateApi: { get: jest.fn() },
}));
jest.mock("../services/integrations.api", () => ({
  ...jest.requireActual("../services/integrations.api"),
  listConnections: jest.fn(),
  startCorosAuthorization: jest.fn(),
  disconnectConnection: jest.fn(),
}));

const profile = {
  userId: "00000000-0000-4000-8000-000000000001",
  displayName: "骑行者",
  phoneMasked: "138****0000",
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
  jest.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    session: {
      user: { id: profile.userId, phone: "13800000000", phoneVerified: false },
      accessToken: "access",
      expiresAt: Date.now() + 60_000,
    },
    logout: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    retry: jest.fn(),
  });
  jest.mocked(getProfile).mockResolvedValue(profile);
  jest.mocked(coachApi.ftp).mockResolvedValue({
    id: profile.userId,
    valueWatts: 200,
    source: "MANUAL",
    measuredAt: "2026-10-01T00:00:00.000Z",
  });
  jest.mocked(heartRateApi.get).mockResolvedValue(null);
  jest.mocked(listConnections).mockResolvedValue([]);
});

async function renderPage(initialUrl = "/profile") {
  await renderRouter(
    {
      _layout: function TestLayout() {
        return (
          <>
            <Text testID="apps-path">{usePathname()}</Text>
            <Stack screenOptions={{ headerShown: false }} />
          </>
        );
      },
      "(tabs)/profile": ProfileScreen,
      "cycling-power-zones": () => <Text>FTP 详情</Text>,
      "heart-rate-zones": () => <Text>心率详情</Text>,
      "third-party-apps": ThirdPartyAppsRoute,
      "coros-callback": CorosCallbackRoute,
    },
    { initialUrl },
  );
}

async function openApps() {
  await renderPage();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "第三方 App" })).toBeTruthy(),
  );
  expect(screen.queryByText("COROS 数据")).toBeNull();
  expect(listConnections).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "第三方 App" }));
  await waitFor(() =>
    expect(screen.getByRole("header", { name: "第三方 App" })).toBeTruthy(),
  );
  await waitFor(() => expect(listConnections).toHaveBeenCalledWith("access"));
}

test("the profile entry opens the COROS card in its own page and returns to profile", async () => {
  await openApps();
  expect(screen.getByTestId("apps-path")).toHaveTextContent(
    "/third-party-apps",
  );
  expect(screen.getByText("COROS 数据")).toBeTruthy();
  expect(screen.getByRole("button", { name: "绑定 COROS" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  await waitFor(() =>
    expect(screen.getByTestId("apps-path")).toHaveTextContent("/profile"),
  );
  expect(screen.queryByText("COROS 数据")).toBeNull();
});

test("one settings group contains all three rows with working independent destinations", async () => {
  await renderPage();
  await waitFor(() => expect(screen.getByText("200 W")).toBeTruthy());
  const group = within(screen.getByTestId("profile-settings-list"));
  expect(
    group.getAllByRole("button").map((row) => row.props.accessibilityLabel),
  ).toEqual(["FTP 功率", "心率区间", "第三方 App"]);
  for (const [name, path] of [
    ["FTP 功率", "/cycling-power-zones"],
    ["心率区间", "/heart-rate-zones"],
    ["第三方 App", "/third-party-apps"],
  ]) {
    await fireEvent.press(screen.getByRole("button", { name }));
    await waitFor(() =>
      expect(screen.getByTestId("apps-path")).toHaveTextContent(path),
    );
    await act(() => router.back());
    await waitFor(() =>
      expect(screen.getByTestId("apps-path")).toHaveTextContent("/profile"),
    );
  }
});

test("opening the apps page directly still offers a return to profile", async () => {
  await renderPage("/third-party-apps");
  expect(screen.getByRole("header", { name: "第三方 App" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "个人信息" })).toBeTruthy(),
  );
  expect(screen.getByTestId("apps-path")).toHaveTextContent("/profile");
});

test("COROS load and authorization errors remain visible on the new page", async () => {
  jest.mocked(listConnections).mockRejectedValue(new Error("无法读取连接状态"));
  await openApps();
  await waitFor(() =>
    expect(screen.getByText("无法读取连接状态")).toBeTruthy(),
  );
  jest
    .mocked(startCorosAuthorization)
    .mockRejectedValue(new Error("授权服务暂不可用"));
  await fireEvent.press(screen.getByRole("button", { name: "绑定 COROS" }));
  await waitFor(() =>
    expect(screen.getByText("授权服务暂不可用")).toBeTruthy(),
  );
  expect(screen.getByTestId("apps-path")).toHaveTextContent(
    "/third-party-apps",
  );
});

test("a cold authorization callback opens the apps page and loads connection status", async () => {
  await renderPage("/coros-callback?status=success");
  await waitFor(() =>
    expect(screen.getByRole("header", { name: "第三方 App" })).toBeTruthy(),
  );
  await waitFor(() => expect(listConnections).toHaveBeenCalledWith("access"));
  expect(screen.getByTestId("apps-path")).toHaveTextContent(
    "/third-party-apps",
  );
});

test("an authorization callback returns to the existing apps page without duplicating it", async () => {
  await openApps();
  await act(() => router.push("/coros-callback?status=success"));
  await waitFor(() =>
    expect(screen.getByRole("header", { name: "第三方 App" })).toBeTruthy(),
  );
  await act(() => router.back());
  await waitFor(() =>
    expect(screen.getByTestId("apps-path")).toHaveTextContent("/profile"),
  );
});

test("a failed callback points users to the apps page for retry", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  try {
    await renderPage("/coros-callback?status=error");
    await waitFor(() =>
      expect(screen.getByRole("header", { name: "第三方 App" })).toBeTruthy(),
    );
    expect(alert).toHaveBeenCalledWith(
      "COROS 授权未完成",
      "请在“第三方 App”页面重试绑定。",
      [{ text: "知道了" }],
    );
    expect(screen.getByRole("button", { name: "绑定 COROS" })).toBeTruthy();
  } finally {
    alert.mockRestore();
  }
});
