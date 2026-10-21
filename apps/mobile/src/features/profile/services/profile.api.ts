import {
  type ProfilePatch,
  profileResponseSchema,
  type ProfileResponse,
} from "@ridepilot/contracts";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { resolveApiBaseUrl } from "../../auth/services/api-base-url";

const API_BASE_URL = resolveApiBaseUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  metroHostUri: Constants.expoConfig?.hostUri,
  platform: Platform.OS,
  isDevelopment: __DEV__,
});

export class ProfileApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

export async function getProfile(
  accessToken: string,
): Promise<ProfileResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_BASE_URL}/me/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ProfileApiError(
        typeof payload?.message === "string"
          ? payload.message
          : "无法加载个人档案",
        response.status,
      );
    }
    const parsed = profileResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ProfileApiError("个人档案数据无效", null);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ProfileApiError) throw error;
    throw new ProfileApiError(
      controller.signal.aborted
        ? "连接超时，请检查网络后重试"
        : "无法连接个人档案服务",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function patchProfile(
  accessToken: string,
  input: ProfilePatch,
): Promise<ProfileResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_BASE_URL}/me/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ProfileApiError(
        typeof payload?.message === "string"
          ? payload.message
          : "保存个人资料失败",
        response.status,
      );
    }
    const parsed = profileResponseSchema.safeParse(payload);
    if (!parsed.success) throw new ProfileApiError("个人档案数据无效", null);
    return parsed.data;
  } catch (error) {
    if (error instanceof ProfileApiError) throw error;
    throw new ProfileApiError(
      controller.signal.aborted
        ? "连接超时，请检查网络后重试"
        : "无法连接个人档案服务",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}
