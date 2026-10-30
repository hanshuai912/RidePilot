import { Text } from "react-native";
import { Stack, router, usePathname } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
  within,
} from "expo-router/testing-library";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { getProfile } from "../services/profile.api";
import { ProfileScreen } from "../screens/ProfileScreen";
import { CyclingPowerZonesScreen } from "../screens/CyclingPowerZonesScreen";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: { ftp: jest.fn(), addFtp: jest.fn() },
}));
jest.mock("../services/profile.api", () => ({ getProfile: jest.fn() }));
jest.mock("../../integrations/components/CorosConnectionCard", () => ({
  CorosConnectionCard: () => null,
}));
const ftp = {
  id: "00000000-0000-4000-8000-000000000001",
  valueWatts: 200,
  measuredAt: "2026-10-01T00:00:00.000Z",
  source: "MANUAL" as const,
};
const api = jest.mocked(coachApi);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    session: {
      user: { id: ftp.id, phone: "13800000000", phoneVerified: false },
      accessToken: "access",
      expiresAt: Date.now() + 60000,
    },
    logout: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    retry: jest.fn(),
  });
  jest.mocked(getProfile).mockResolvedValue({
    userId: ftp.id,
    displayName: "骑行者",
    phoneMasked: "138****0000",
    phoneVerificationStatus: "UNVERIFIED",
    gender: null,
    birthDate: null,
    heightCm: null,
    weightKg: null,
    experienceLevel: null,
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    version: 1,
  });
  api.ftp.mockResolvedValue(ftp);
  api.addFtp.mockImplementation(async (_token, valueWatts) => ({
    ...ftp,
    valueWatts,
  }));
});
function TestLayout() {
  return (
    <>
      <Text testID="ftp-path">{usePathname()}</Text>
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
async function open() {
  await renderRouter(
    {
      _layout: TestLayout,
      profile: ProfileScreen,
      "cycling-power-zones": CyclingPowerZonesScreen,
    },
    { initialUrl: "/profile" },
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "FTP 功率" })).toBeTruthy(),
  );
  await waitFor(() => expect(screen.queryByLabelText("读取 FTP")).toBeNull());
  expect(screen.queryByText(/最近测量|手动录入|2026-10-01/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "FTP 功率" }));
  await waitFor(() => expect(screen.getByLabelText("FTP 数值")).toBeTruthy());
}

test("FTP card opens its own page, calculations update live and saving refreshes the card", async () => {
  await open();
  expect(screen.getByTestId("ftp-path")).toHaveTextContent(
    "/cycling-power-zones",
  );
  expect(screen.getByRole("header", { name: "骑行功率区间" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "保存 FTP" })).toBeDisabled();
  expect(
    within(screen.getByTestId("power-zone-Z7")).getByText("≥301 W"),
  ).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("FTP 数值"), "193");
  expect(
    within(screen.getByTestId("power-zone-Z1")).getByText("0–106 W"),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId("power-zone-Z2")).getByText("107–144 W"),
  ).toBeTruthy();
  expect(
    within(screen.getByTestId("power-zone-Z7")).getByText("≥290 W"),
  ).toBeTruthy();
  expect(api.addFtp).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("FTP 数值"), "200");
  expect(screen.getByRole("button", { name: "保存 FTP" })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("FTP 数值"), "250");
  api.ftp.mockResolvedValue({ ...ftp, valueWatts: 250 });
  await fireEvent.press(screen.getByRole("button", { name: "保存 FTP" }));
  await waitFor(() =>
    expect(screen.getByTestId("ftp-path")).toHaveTextContent("/profile"),
  );
  expect(api.addFtp).toHaveBeenCalledWith("access", 250);
  await waitFor(() => expect(screen.getByText("250 W")).toBeTruthy());
  expect(screen.queryByText("有未保存的修改")).toBeNull();
});

test("an empty FTP shows no invented wattages and supports first entry", async () => {
  api.ftp.mockResolvedValue(null);
  await open();
  expect(screen.getAllByText("— W")).toHaveLength(7);
  expect(screen.getByRole("button", { name: "保存 FTP" })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("FTP 数值"), "200");
  expect(screen.getByRole("button", { name: "保存 FTP" })).toBeEnabled();
  expect(screen.queryByText("— W")).toBeNull();
});

test.each(["", "49", "801", "200.5", "abc"])(
  "invalid FTP %s cannot be saved or used to calculate zones",
  async (text) => {
    await open();
    await fireEvent.changeText(screen.getByLabelText("FTP 数值"), text);
    expect(screen.getByRole("button", { name: "保存 FTP" })).toBeDisabled();
    expect(screen.getAllByText("— W")).toHaveLength(7);
    await fireEvent.press(screen.getByRole("button", { name: "保存 FTP" }));
    expect(api.addFtp).not.toHaveBeenCalled();
  },
);

test("unchanged back leaves directly; changed system back offers continue or discard", async () => {
  await open();
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  await waitFor(() =>
    expect(screen.getByTestId("ftp-path")).toHaveTextContent("/profile"),
  );
  expect(screen.queryByText("有未保存的修改")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "FTP 功率" }));
  await waitFor(() => expect(screen.getByLabelText("FTP 数值")).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText("FTP 数值"), "250");
  await act(() => router.back());
  await waitFor(() => expect(screen.getByText("有未保存的修改")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "继续编辑" }));
  expect(screen.getByLabelText("FTP 数值")).toHaveDisplayValue("250");
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  await fireEvent.press(screen.getByRole("button", { name: "放弃修改" }));
  await waitFor(() =>
    expect(screen.getByTestId("ftp-path")).toHaveTextContent("/profile"),
  );
  expect(api.addFtp).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "FTP 功率" }));
  await waitFor(() =>
    expect(screen.getByLabelText("FTP 数值")).toHaveDisplayValue("200"),
  );
});

test("a failed save keeps FTP and zones editable with unsaved protection", async () => {
  await open();
  api.addFtp.mockRejectedValueOnce(new Error("保存失败，请重试"));
  await fireEvent.changeText(screen.getByLabelText("FTP 数值"), "250");
  await fireEvent.press(screen.getByRole("button", { name: "保存 FTP" }));
  await waitFor(() =>
    expect(screen.getByText("保存失败，请重试")).toBeTruthy(),
  );
  expect(screen.getByLabelText("FTP 数值")).toHaveDisplayValue("250");
  expect(screen.getByRole("button", { name: "保存 FTP" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  expect(screen.getByText("有未保存的修改")).toBeTruthy();
});

test("failed initial loading offers retry without exposing an editable blank FTP", async () => {
  api.ftp
    .mockResolvedValueOnce(ftp)
    .mockRejectedValueOnce(new Error("读取失败，请重试"));
  await renderRouter(
    {
      _layout: TestLayout,
      profile: ProfileScreen,
      "cycling-power-zones": CyclingPowerZonesScreen,
    },
    { initialUrl: "/profile" },
  );
  await waitFor(() => expect(screen.getByText("200 W")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "FTP 功率" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "重新加载" })).toBeTruthy(),
  );
  expect(screen.queryByLabelText("FTP 数值")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "重新加载" }));
  await waitFor(() =>
    expect(screen.getByLabelText("FTP 数值")).toHaveDisplayValue("200"),
  );
});

test("saving prevents duplicate requests and route removal", async () => {
  let finish!: (result: typeof ftp) => void;
  api.addFtp.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await open();
  await fireEvent.changeText(screen.getByLabelText("FTP 数值"), "250");
  await fireEvent.press(screen.getByRole("button", { name: "保存 FTP" }));
  expect(screen.getByLabelText("FTP 数值")).toHaveProp("editable", false);
  expect(screen.getByRole("button", { name: "返回我的" })).toBeDisabled();
  await act(() => router.back());
  expect(screen.getByTestId("ftp-path")).toHaveTextContent(
    "/cycling-power-zones",
  );
  expect(api.addFtp).toHaveBeenCalledTimes(1);
  await act(() => finish({ ...ftp, valueWatts: 250 }));
  await waitFor(() =>
    expect(screen.getByTestId("ftp-path")).toHaveTextContent("/profile"),
  );
});
