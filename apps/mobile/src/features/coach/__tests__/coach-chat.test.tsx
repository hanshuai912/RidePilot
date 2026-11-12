import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Keyboard, Platform, StyleSheet } from "react-native";
import type { CoachChatTurn } from "@ridepilot/contracts";
import { CoachChatScreen } from "../screens/CoachChatScreen";
import { coachCenterApi } from "../services/coach-center.api";

const mockReplace = jest.fn();
let mockUser: string | null = "user-a";
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 24, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({
  useAuth: () => ({
    session: mockUser
      ? { user: { id: mockUser }, accessToken: `token-${mockUser}` }
      : null,
  }),
}));
jest.mock("../services/coach-center.api", () => ({
  coachCenterApi: {
    chatHistory: jest.fn(),
    sendChat: jest.fn(),
    chatTurn: jest.fn(),
  },
}));
const api = jest.mocked(coachCenterApi);
const turn: CoachChatTurn = {
  id: "00000000-0000-4000-8000-000000000001",
  clientMessageId: "chat-existing-001",
  question: "为什么安排耐力训练？",
  answer: "有助于建立耐力基础。",
  status: "COMPLETED",
  version: 2,
  createdAt: "2026-11-12T01:00:00.000Z",
  updatedAt: "2026-11-12T01:00:05.000Z",
  errorMessage: null,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = "user-a";
  api.chatHistory.mockResolvedValue({ turns: [], nextCursor: null });
  api.chatTurn.mockResolvedValue(null);
  api.sendChat.mockImplementation(async (_token, input) => ({
    ...turn,
    clientMessageId: input.clientMessageId,
    question: input.message,
  }));
});

it("restores saved history on each entry and separates account sessions", async () => {
  api.chatHistory.mockResolvedValue({ turns: [turn], nextCursor: null });
  const screen = await render(<CoachChatScreen />);
  await screen.findByText(turn.question);
  expect(api.sendChat).not.toHaveBeenCalled();
  await screen.unmount();
  const reopened = await render(<CoachChatScreen />);
  await reopened.findByText(turn.answer!);
  expect(api.chatHistory).toHaveBeenCalledTimes(2);
  mockUser = "user-b";
  api.chatHistory.mockResolvedValue({ turns: [], nextCursor: null });
  await reopened.rerender(<CoachChatScreen />);
  await reopened.findByText("今天想聊点什么？");
  expect(reopened.queryByText(turn.question)).toBeNull();
  expect(api.chatHistory).toHaveBeenLastCalledWith("token-user-b");
});

it("shows the question immediately, prevents duplicate sending and keeps the next draft", async () => {
  let resolve!: (value: CoachChatTurn) => void;
  api.sendChat.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const screen = await render(<CoachChatScreen />);
  await screen.findByText("今天想聊点什么？");
  await fireEvent.changeText(
    screen.getByLabelText("向 AI 教练提问"),
    "今天应该练什么？",
  );
  await fireEvent.press(screen.getByRole("button", { name: "发送问题" }));
  await screen.findByText("今天应该练什么？");
  expect(screen.getByText("正在回复…")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "发送问题" }));
  expect(api.sendChat).toHaveBeenCalledTimes(1);
  await fireEvent.changeText(
    screen.getByLabelText("向 AI 教练提问"),
    "下一条草稿",
  );
  await act(async () =>
    resolve({
      ...turn,
      clientMessageId: api.sendChat.mock.calls[0][1].clientMessageId,
      question: "今天应该练什么？",
    }),
  );
  await screen.findByText(turn.answer!);
  expect(screen.getByLabelText("向 AI 教练提问").props.value).toBe(
    "下一条草稿",
  );
  expect(api.sendChat.mock.calls[0][1]).not.toHaveProperty("history");
});

it("retries a failed saved question using the same message key and current version", async () => {
  api.chatHistory.mockResolvedValue({
    turns: [
      { ...turn, status: "FAILED", answer: null, errorMessage: "AI 回答超时" },
    ],
    nextCursor: null,
  });
  const screen = await render(<CoachChatScreen />);
  await screen.findByText("AI 回答超时");
  await fireEvent.press(
    screen.getByRole("button", { name: `重试提问：${turn.question}` }),
  );
  await screen.findByText(turn.answer!);
  expect(api.sendChat).toHaveBeenCalledWith("token-user-a", {
    clientMessageId: turn.clientMessageId,
    message: turn.question,
    expectedVersion: 2,
  });
  expect(screen.getAllByText(turn.question)).toHaveLength(1);
});

it("reconciles a lost POST response with the persisted reply instead of duplicating it", async () => {
  api.sendChat.mockRejectedValueOnce(new Error("连接超时"));
  api.chatTurn.mockImplementation(async (_token, key) => ({
    ...turn,
    clientMessageId: key,
    question: "刚才发送的问题",
  }));
  const screen = await render(<CoachChatScreen />);
  await screen.findByText("今天想聊点什么？");
  await fireEvent.changeText(
    screen.getByLabelText("向 AI 教练提问"),
    "刚才发送的问题",
  );
  await fireEvent.press(screen.getByRole("button", { name: "发送问题" }));
  await screen.findByText(turn.answer!);
  expect(screen.getAllByText("刚才发送的问题")).toHaveLength(1);
  expect(screen.queryByText("连接超时")).toBeNull();
});

it("keeps an offline question retryable and loads earlier history without dropping newer messages", async () => {
  api.chatHistory
    .mockResolvedValueOnce({ turns: [turn], nextCursor: turn.id })
    .mockRejectedValueOnce(new Error("更早记录断网"))
    .mockResolvedValue({
      turns: [
        {
          ...turn,
          id: "00000000-0000-4000-8000-000000000002",
          clientMessageId: "older-message",
          question: "更早的问题",
          createdAt: "2026-11-11T01:00:00.000Z",
        },
      ],
      nextCursor: null,
    });
  const screen = await render(<CoachChatScreen />);
  await screen.findByText(turn.question);
  await fireEvent.press(screen.getByText("查看更早消息"));
  await screen.findByText("更早记录断网");
  await fireEvent.press(screen.getByText("查看更早消息"));
  await screen.findByText("更早的问题");
  expect(screen.getByText(turn.question)).toBeTruthy();
  api.sendChat.mockRejectedValueOnce(new Error("无法连接服务"));
  await fireEvent.changeText(
    screen.getByLabelText("向 AI 教练提问"),
    "离线问题",
  );
  await fireEvent.press(screen.getByRole("button", { name: "发送问题" }));
  await screen.findByText("无法连接服务");
  await fireEvent.press(
    screen.getByRole("button", { name: "重试提问：离线问题" }),
  );
  await waitFor(() => expect(api.sendChat).toHaveBeenCalledTimes(2));
  expect(api.sendChat.mock.calls[0][1].clientMessageId).toBe(
    api.sendChat.mock.calls[1][1].clientMessageId,
  );
});

it("polls a restored pending reply and stops polling when it finishes", async () => {
  jest.useFakeTimers();
  try {
    api.chatHistory.mockResolvedValue({
      turns: [{ ...turn, status: "PROCESSING", answer: null, version: 1 }],
      nextCursor: null,
    });
    api.chatTurn.mockResolvedValue(turn);
    const screen = await render(<CoachChatScreen />);
    await screen.findByText("正在回复…");
    await act(async () => jest.advanceTimersByTime(3000));
    await screen.findByText(turn.answer!);
    await act(async () => jest.advanceTimersByTime(6000));
    expect(api.chatTurn).toHaveBeenCalledTimes(1);
    await screen.unmount();
  } finally {
    jest.useRealTimers();
  }
});

it("supports history read retry and disables sending while history is unknown or signed out", async () => {
  api.chatHistory.mockRejectedValueOnce(new Error("读取失败"));
  const screen = await render(<CoachChatScreen />);
  await screen.findByText("读取失败");
  await fireEvent.changeText(screen.getByLabelText("向 AI 教练提问"), "问题");
  expect(
    screen.getByRole("button", { name: "发送问题" }).props.accessibilityState
      .disabled,
  ).toBe(true);
  await fireEvent.press(screen.getByText("重新读取聊天记录"));
  await screen.findByText("今天想聊点什么？");
  mockUser = null;
  await screen.rerender(<CoachChatScreen />);
  await screen.findByText("请先登录");
  expect(
    screen.getByRole("button", { name: "发送问题" }).props.accessibilityState
      .disabled,
  ).toBe(true);
});

it.each(["ios", "android"] as const)(
  "keeps the %s composer inside keyboard avoidance and removes the bottom inset while typing",
  async (platform) => {
    const original = Platform.OS;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: platform,
    });
    const listeners: Record<
      string,
      Parameters<typeof Keyboard.addListener>[1][]
    > = {};
    const addListener = Keyboard.addListener.bind(Keyboard);
    const listener = jest
      .spyOn(Keyboard, "addListener")
      .mockImplementation((name, callback) => {
        (listeners[name] ??= []).push(callback);
        return addListener(name, callback);
      });
    const keyboardEvent = {
      duration: 0,
      easing: "keyboard" as const,
      endCoordinates: { screenX: 0, screenY: 500, width: 390, height: 300 },
      startCoordinates: { screenX: 0, screenY: 800, width: 390, height: 0 },
    };
    try {
      const screen = await render(<CoachChatScreen />);
      await screen.findByText("今天想聊点什么？");
      await fireEvent(screen.getByTestId("coach-chat-keyboard"), "layout", {
        persist: () => {},
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 776 } },
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId("coach-chat-composer").props.style,
        ).paddingBottom,
      ).toBe(34);
      await act(async () => {
        for (const callback of listeners[
          platform === "ios" ? "keyboardWillShow" : "keyboardDidShow"
        ])
          callback(keyboardEvent);
      });
      await waitFor(() => {
        const style = StyleSheet.flatten(
          screen.getByTestId("coach-chat-keyboard").props.style,
        );
        if (platform === "ios") expect(style.paddingBottom).toBe(300);
        else expect(style.height).toBe(476);
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId("coach-chat-composer").props.style,
        ).paddingBottom,
      ).toBe(4);
      await act(async () => {
        for (const callback of listeners[
          platform === "ios" ? "keyboardWillHide" : "keyboardDidHide"
        ])
          callback(keyboardEvent);
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId("coach-chat-composer").props.style,
        ).paddingBottom,
      ).toBe(34);
      expect(
        StyleSheet.flatten(
          screen.getByTestId("coach-chat-keyboard").props.style,
        ).height,
      ).toBeUndefined();
      await screen.unmount();
    } finally {
      listener.mockRestore();
      Object.defineProperty(Platform, "OS", {
        configurable: true,
        value: original,
      });
    }
  },
);
