import {
  authResponseSchema,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
} from "@ridepilot/contracts";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolveApiBaseUrl } from "./api-base-url";

const API_BASE_URL = resolveApiBaseUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  metroHostUri: Constants.expoConfig?.hostUri,
  platform: Platform.OS,
  isDevelopment: __DEV__,
});

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
    readonly fields?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_BASE_URL}/auth/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new AuthApiError(
        typeof payload?.message === "string"
          ? payload.message
          : "请求失败，请稍后重试",
        response.status,
        typeof payload?.code === "string" ? payload.code : undefined,
        Array.isArray(payload?.fields) ? payload.fields : undefined,
      );
    }
    if (response.status === 204) return undefined as T;
    const data = await response.json();
    const parsed = authResponseSchema.safeParse(data);
    if (!parsed.success) throw new AuthApiError("认证服务返回的数据无效", null);
    return parsed.data as T;
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError(
      controller.signal.aborted
        ? "连接超时，请检查网络后重试"
        : "无法连接认证服务，请检查网络和 API 地址",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const authApi = {
  register: (input: RegisterRequest) =>
    request<AuthResponse>("register", input),
  login: (input: LoginRequest) => request<AuthResponse>("login", input),
  refresh: (refreshToken: string) =>
    request<AuthResponse>("refresh", { refreshToken }),
  logout: (accessToken: string) =>
    request<void>("logout", undefined, accessToken),
};
