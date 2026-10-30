import {
  heartRateReadSchema,
  heartRateResponseSchema,
  type HeartRateSave,
} from "@ridepilot/contracts";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolveApiBaseUrl } from "../../auth/services/api-base-url";

const baseUrl = resolveApiBaseUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  metroHostUri: Constants.expoConfig?.hostUri,
  platform: Platform.OS,
  isDevelopment: __DEV__,
});

async function request(token: string, input?: HeartRateSave) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${baseUrl}/me/heart-rate-settings`, {
      method: input ? "PUT" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(input ? { "Content-Type": "application/json" } : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        response.status === 409
          ? "心率设置已在其他页面更新。草稿已保留，请返回后重新进入此页读取最新设置。"
          : input
            ? "保存心率设置失败，请重试"
            : "读取心率设置失败，请重试",
      );
    }
    return payload;
  } catch (cause) {
    if (controller.signal.aborted)
      throw new Error("连接超时，请检查网络后重试");
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export const heartRateApi = {
  async get(token: string) {
    return heartRateReadSchema.parse(await request(token)).settings;
  },
  async save(token: string, input: HeartRateSave) {
    return heartRateResponseSchema.parse(await request(token, input));
  },
};
