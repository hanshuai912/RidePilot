import { webAuthStorage } from "../services/web-auth-storage";

const entries = new Map<string, string>();
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "sessionStorage",
);
const storage = {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => {
    entries.set(key, value);
  },
  removeItem: (key: string) => {
    entries.delete(key);
  },
} as Storage;

beforeAll(() => {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storage,
  });
});

afterAll(() => {
  if (originalStorage) {
    Object.defineProperty(globalThis, "sessionStorage", originalStorage);
  } else {
    Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

beforeEach(() => entries.clear());

test("refresh token survives a module reload in the same browser tab", () => {
  webAuthStorage.setRefreshToken("rotating-refresh-token");
  jest.resetModules();
  const reloaded = jest.requireActual<
    typeof import("../services/web-auth-storage")
  >("../services/web-auth-storage");
  expect(reloaded.webAuthStorage.getRefreshToken()).toBe(
    "rotating-refresh-token",
  );
  reloaded.webAuthStorage.clearRefreshToken();
  expect(webAuthStorage.getRefreshToken()).toBeNull();
});
