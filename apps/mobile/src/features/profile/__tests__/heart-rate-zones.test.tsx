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
import { type HeartRateResponse } from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { heartRateApi } from "../services/heart-rate.api";
import { HeartRateZonesScreen } from "../screens/HeartRateZonesScreen";
import { HeartRateSettingsCard } from "../components/HeartRateSettingsCard";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../services/heart-rate.api", () => ({
  heartRateApi: { get: jest.fn(), save: jest.fn() },
}));
const stored: HeartRateResponse = {
  method: "MAX",
  maxHeartRate: 200,
  restingHeartRate: 60,
  lactateThresholdHeartRate: 180,
  ruleVersion: 1,
  version: 1,
  updatedAt: "2026-10-01T00:00:00.000Z",
};
const api = jest.mocked(heartRateApi);
function TestLayout() {
  return (
    <>
      <Text testID="hr-path">{usePathname()}</Text>
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
function Profile() {
  return <HeartRateSettingsCard token="access" />;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useAuth)
    .mockReturnValue({
      status: "authenticated",
      session: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          phone: "13800000000",
          phoneVerified: false,
        },
        accessToken: "access",
        expiresAt: Date.now() + 60000,
      },
      logout: jest.fn(),
      login: jest.fn(),
      register: jest.fn(),
      retry: jest.fn(),
    });
  api.get.mockResolvedValue(stored);
  api.save.mockImplementation(
    async (_token, { expectedVersion, ...values }) => ({
      ...stored,
      ...values,
      version: expectedVersion + 1,
    }),
  );
});
async function open() {
  await renderRouter(
    {
      _layout: TestLayout,
      profile: Profile,
      "heart-rate-zones": HeartRateZonesScreen,
    },
    { initialUrl: "/profile" },
  );
  await waitFor(() =>
    expect(screen.queryByLabelText("读取心率设置")).toBeNull(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "心率区间" }));
  await waitFor(() => expect(screen.getByLabelText("最大心率")).toBeTruthy());
}
const saveButton = () => screen.getByRole("button", { name: "保存心率设置" });
test("card opens unified settings and all methods calculate live without dropping hidden inputs", async () => {
  await open();
  expect(screen.getByRole("header", { name: "心率区间" })).toBeTruthy();
  expect(saveButton()).toBeDisabled();
  expect(
    within(screen.getByTestId("heart-rate-zone-Z2")).getByText("120–139 bpm"),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "储备心率区间" }));
  expect(screen.getByLabelText("静息心率")).toHaveDisplayValue("60");
  expect(
    within(screen.getByTestId("heart-rate-zone-Z2")).getByText("144–157 bpm"),
  ).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("静息心率"), "50");
  await fireEvent.press(screen.getByRole("radio", { name: "乳酸阈心率区间" }));
  expect(screen.getByLabelText("乳酸阈心率")).toHaveDisplayValue("180");
  expect(
    within(screen.getByTestId("heart-rate-zone-Z7")).getByText("≥193 bpm"),
  ).toBeTruthy();
  expect(screen.queryByText(/骑行乳酸阈/)).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("乳酸阈心率"), "170");
  expect(
    within(screen.getByTestId("heart-rate-zone-Z7")).getByText("≥182 bpm"),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "储备心率区间" }));
  expect(screen.getByLabelText("静息心率")).toHaveDisplayValue("50");
  await fireEvent.press(screen.getByRole("radio", { name: "乳酸阈心率区间" }));
  api.get.mockResolvedValue({
    ...stored,
    method: "LTHR",
    restingHeartRate: 50,
    lactateThresholdHeartRate: 170,
    version: 2,
  });
  await fireEvent.press(saveButton());
  await waitFor(() =>
    expect(screen.getByTestId("hr-path")).toHaveTextContent("/profile"),
  );
  expect(api.save).toHaveBeenCalledWith("access", {
    method: "LTHR",
    maxHeartRate: 200,
    restingHeartRate: 50,
    lactateThresholdHeartRate: 170,
    expectedVersion: 1,
  });
  await waitFor(() =>
    expect(screen.getByText("乳酸阈心率区间 · 7 区")).toBeTruthy(),
  );
});
test("first entry uses blanks, disabled save, and no fabricated ranges", async () => {
  api.get.mockResolvedValue(null);
  await open();
  expect(screen.getAllByText("— bpm")).toHaveLength(5);
  expect(saveButton()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("最大心率"), "200");
  expect(saveButton()).toBeEnabled();
  await fireEvent.press(screen.getByRole("radio", { name: "储备心率区间" }));
  expect(saveButton()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("静息心率"), "60");
  expect(saveButton()).toBeEnabled();
  await fireEvent.press(saveButton());
  await waitFor(() =>
    expect(api.save).toHaveBeenCalledWith("access", {
      method: "RESERVE",
      maxHeartRate: 200,
      restingHeartRate: 60,
      lactateThresholdHeartRate: null,
      expectedVersion: 0,
    }),
  );
});
test.each(["abc", "200.5", "79", "251", ""])(
  "invalid max heart rate %s cannot save",
  async (value) => {
    await open();
    await fireEvent.changeText(screen.getByLabelText("最大心率"), value);
    expect(saveButton()).toBeDisabled();
    expect(screen.getAllByText("— bpm")).toHaveLength(5);
    await fireEvent.press(saveButton());
    expect(api.save).not.toHaveBeenCalled();
  },
);
test("resting heart rate must be lower and invalid hidden input has an explicit error", async () => {
  await open();
  await fireEvent.press(screen.getByRole("radio", { name: "储备心率区间" }));
  await fireEvent.changeText(screen.getByLabelText("静息心率"), "200");
  expect(screen.getByText("静息心率必须小于最大心率")).toBeTruthy();
  expect(saveButton()).toBeDisabled();
  await fireEvent.press(screen.getByRole("radio", { name: "乳酸阈心率区间" }));
  expect(screen.getByText("静息心率必须小于最大心率")).toBeTruthy();
  expect(saveButton()).toBeDisabled();
});
test("unchanged back exits directly and changed system back supports continue or discard", async () => {
  await open();
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  await waitFor(() =>
    expect(screen.getByTestId("hr-path")).toHaveTextContent("/profile"),
  );
  expect(screen.queryByText("有未保存的修改")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "心率区间" }));
  await waitFor(() => expect(screen.getByLabelText("最大心率")).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText("最大心率"), "190");
  await act(() => router.back());
  await waitFor(() => expect(screen.getByText("有未保存的修改")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "继续编辑" }));
  expect(screen.getByLabelText("最大心率")).toHaveDisplayValue("190");
  await fireEvent.press(screen.getByRole("button", { name: "返回我的" }));
  await fireEvent.press(screen.getByRole("button", { name: "放弃修改" }));
  await waitFor(() =>
    expect(screen.getByTestId("hr-path")).toHaveTextContent("/profile"),
  );
  expect(api.save).not.toHaveBeenCalled();
});
test("failed save retains draft; retry sends the same version and saves only once in flight", async () => {
  await open();
  api.save.mockRejectedValueOnce(new Error("保存心率设置失败，请重试"));
  await fireEvent.changeText(screen.getByLabelText("最大心率"), "190");
  await fireEvent.press(saveButton());
  await waitFor(() =>
    expect(screen.getByText("保存心率设置失败，请重试")).toBeTruthy(),
  );
  expect(screen.getByLabelText("最大心率")).toHaveDisplayValue("190");
  let finish!: (value: HeartRateResponse) => void;
  api.save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await fireEvent.press(saveButton());
  await fireEvent.press(saveButton());
  expect(api.save).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("最大心率")).toHaveProp("editable", false);
  await act(() => router.back());
  expect(screen.getByTestId("hr-path")).toHaveTextContent("/heart-rate-zones");
  await act(() => finish({ ...stored, maxHeartRate: 190, version: 2 }));
  await waitFor(() =>
    expect(screen.getByTestId("hr-path")).toHaveTextContent("/profile"),
  );
});
test("read failure offers retry without allowing an unversioned overwrite", async () => {
  api.get
    .mockResolvedValueOnce(stored)
    .mockRejectedValueOnce(new Error("读取失败"));
  await renderRouter(
    {
      _layout: TestLayout,
      profile: Profile,
      "heart-rate-zones": HeartRateZonesScreen,
    },
    { initialUrl: "/profile" },
  );
  await waitFor(() =>
    expect(screen.queryByLabelText("读取心率设置")).toBeNull(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "心率区间" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "重新加载" })).toBeTruthy(),
  );
  expect(screen.queryByRole("button", { name: "保存心率设置" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "重新加载" }));
  await waitFor(() =>
    expect(screen.getByLabelText("最大心率")).toHaveDisplayValue("200"),
  );
});
