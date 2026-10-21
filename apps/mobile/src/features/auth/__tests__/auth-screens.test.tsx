import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { useAuth } from "../hooks/AuthProvider";
import { AuthApiError } from "../services/auth.api";
import { router } from "expo-router";

jest.setTimeout(15000);

jest.mock("../hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => false },
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const login = jest.fn().mockResolvedValue(undefined);
const register = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    status: "guest",
    session: null,
    login,
    register,
    logout: jest.fn(),
    retry: jest.fn(),
  });
});

test("welcome offers registration and login entry points", async () => {
  const screen = await render(<WelcomeScreen />);
  expect(screen.getByText("每一次训练，")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "创建账号" }));
  expect(router.push).toHaveBeenCalledWith("/register");
  await fireEvent.press(screen.getByRole("button", { name: "已有账号，登录" }));
  expect(router.push).toHaveBeenCalledWith("/login");
});

test("login rejects invalid phone locally and submits valid credentials", async () => {
  const screen = await render(<LoginScreen />);
  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入手机号"),
    "123",
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入密码"),
    "secret",
  );
  await fireEvent.press(screen.getByText("登录"));
  expect(await screen.findByText("手机号须为 11 位数字")).toBeTruthy();
  expect(login).not.toHaveBeenCalled();

  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入手机号"),
    "13812345678",
  );
  await fireEvent.press(screen.getByText("登录"));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith({
      phone: "13812345678",
      password: "secret",
    }),
  );
});

test("register requires matching passwords and a six-digit test code", async () => {
  const screen = await render(<RegisterScreen />);
  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入手机号"),
    "13812345678",
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入验证码"),
    "12345",
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("请设置密码"),
    "Abcdef!",
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("请再次输入密码"),
    "Abcdef?",
  );
  await fireEvent.press(screen.getByRole("button", { name: "创建账号" }));
  expect(await screen.findByText("验证码须为 6 位数字")).toBeTruthy();
  expect(screen.getByText("两次输入的密码不一致")).toBeTruthy();
  expect(register).not.toHaveBeenCalled();

  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入验证码"),
    "123456",
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("请再次输入密码"),
    "Abcdef!",
  );
  await fireEvent.press(screen.getByRole("button", { name: "创建账号" }));
  await waitFor(() =>
    expect(register).toHaveBeenCalledWith({
      phone: "13812345678",
      verificationCode: "123456",
      password: "Abcdef!",
      confirmPassword: "Abcdef!",
    }),
  );
});

test("login failure keeps the form and shows a safe credential error", async () => {
  login.mockRejectedValueOnce(
    new AuthApiError("手机号或密码错误", 401, "INVALID_CREDENTIALS"),
  );
  const screen = await render(<LoginScreen />);
  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入手机号"),
    "13812345678",
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入密码"),
    "wrong",
  );
  await fireEvent.press(screen.getByRole("button", { name: "登录" }));
  expect(await screen.findByText("手机号或密码不正确")).toBeTruthy();
  expect(screen.getByPlaceholderText("请输入手机号").props.value).toBe(
    "13812345678",
  );
});

test("empty login password shows a Chinese validation message", async () => {
  const screen = await render(<LoginScreen />);
  await fireEvent.changeText(
    screen.getByPlaceholderText("请输入手机号"),
    "13812345678",
  );
  await fireEvent.press(screen.getByRole("button", { name: "登录" }));
  expect(await screen.findByText("请输入密码")).toBeTruthy();
  expect(login).not.toHaveBeenCalled();
});
