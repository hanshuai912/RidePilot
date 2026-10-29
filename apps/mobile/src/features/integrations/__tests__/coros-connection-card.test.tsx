import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { CorosConnectionCard } from "../components/CorosConnectionCard";
import {
  listConnections,
  startCorosAuthorization,
} from "../services/integrations.api";
import { openURL } from "expo-linking";

jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../services/integrations.api", () => ({
  listConnections: jest.fn(),
  startCorosAuthorization: jest.fn(),
  disconnectConnection: jest.fn(),
}));
jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
  parse: jest.fn(() => ({ queryParams: {} })),
  useLinkingURL: jest.fn(() => null),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedListConnections = listConnections as jest.MockedFunction<
  typeof listConnections
>;
const mockedStartAuthorization = startCorosAuthorization as jest.MockedFunction<
  typeof startCorosAuthorization
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
      accessToken: "access",
      expiresAt: Date.now() + 60_000,
    },
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    retry: jest.fn(),
  });
  mockedListConnections.mockResolvedValue([]);
  mockedStartAuthorization.mockResolvedValue({
    providerKey: "coros",
    authorizationAttemptId: "00000000-0000-0000-0000-000000000002",
    authorizationUrl: "https://coros.example/authorize",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
});

test("opens the COROS authorization URL from the data source card", async () => {
  const screen = await render(<CorosConnectionCard />);
  await waitFor(() =>
    expect(mockedListConnections).toHaveBeenCalledWith("access"),
  );
  await fireEvent.press(screen.getByRole("button", { name: "绑定 COROS" }));
  await waitFor(() =>
    expect(openURL).toHaveBeenCalledWith("https://coros.example/authorize"),
  );
});
