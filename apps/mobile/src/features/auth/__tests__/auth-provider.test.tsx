import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { AuthProvider, useAuth } from "../hooks/AuthProvider";
import { authApi, AuthApiError } from "../services/auth.api";
import { authStorage } from "../services/auth-storage";

jest.mock("../services/auth.api", () => ({
  ...jest.requireActual("../services/auth.api"),
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  },
}));
jest.mock("../services/auth-storage", () => ({
  authStorage: {
    getRefreshToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clearRefreshToken: jest.fn(),
  },
}));

const getRefreshToken = authStorage.getRefreshToken as jest.MockedFunction<
  typeof authStorage.getRefreshToken
>;
const refresh = authApi.refresh as jest.MockedFunction<typeof authApi.refresh>;
const clearRefreshToken = authStorage.clearRefreshToken as jest.MockedFunction<
  typeof authStorage.clearRefreshToken
>;

const response = {
  user: {
    id: "20c10a0e-1f2a-4b5c-8d9e-000000000001",
    phone: "13812345678",
    phoneVerified: false,
  },
  tokens: {
    accessToken: "access",
    refreshToken: "rotated",
    tokenType: "Bearer" as const,
    expiresInSeconds: 900,
  },
};

function Probe() {
  const { status, session, logout } = useAuth();
  return (
    <>
      <Text>
        {status}
        {session ? `:${session.user.phone}` : ""}
      </Text>
      <Pressable onPress={() => void logout()} accessibilityRole="button">
        <Text>退出</Text>
      </Pressable>
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (authStorage.setRefreshToken as jest.Mock).mockResolvedValue(undefined);
  clearRefreshToken.mockResolvedValue(undefined);
  (authApi.logout as jest.Mock).mockResolvedValue(undefined);
});

test("startup without a stored session opens guest routes", async () => {
  getRefreshToken.mockResolvedValue(null);
  const screen = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  expect(await screen.findByText("guest")).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
});

test("startup refreshes stored session and logout revokes it", async () => {
  getRefreshToken.mockResolvedValue("stored");
  refresh.mockResolvedValue(response);
  const screen = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  expect(await screen.findByText("authenticated:13812345678")).toBeTruthy();
  expect(refresh).toHaveBeenCalledWith("stored");
  expect(authStorage.setRefreshToken).toHaveBeenCalledWith("rotated");
  await fireEvent.press(screen.getByRole("button", { name: "退出" }));
  expect(await screen.findByText("guest")).toBeTruthy();
  expect(authApi.logout).toHaveBeenCalledWith("access");
  expect(clearRefreshToken).toHaveBeenCalled();
});

test("invalid stored session is cleared, network failure offers retry state", async () => {
  getRefreshToken.mockResolvedValue("stored");
  refresh.mockRejectedValueOnce(new AuthApiError("失效", 401));
  const invalid = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  expect(await invalid.findByText("guest")).toBeTruthy();
  expect(clearRefreshToken).toHaveBeenCalled();
  await invalid.unmount();

  clearRefreshToken.mockClear();
  refresh.mockRejectedValueOnce(new AuthApiError("网络失败", null));
  const offline = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  expect(await offline.findByText("unavailable")).toBeTruthy();
  expect(clearRefreshToken).not.toHaveBeenCalled();
});
