const REFRESH_TOKEN_KEY = "ridepilot.refresh-token";

function browserStorage(): Storage {
  if (typeof sessionStorage === "undefined") {
    throw new Error("浏览器会话存储不可用");
  }
  return sessionStorage;
}

export const webAuthStorage = {
  getRefreshToken(): string | null {
    return browserStorage().getItem(REFRESH_TOKEN_KEY);
  },
  setRefreshToken(token: string): void {
    browserStorage().setItem(REFRESH_TOKEN_KEY, token);
  },
  clearRefreshToken(): void {
    browserStorage().removeItem(REFRESH_TOKEN_KEY);
  },
};
