import {
  homeTodayResponseSchema,
  type HomeTodayResponse,
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

export const homeApi = {
  async today(token: string): Promise<HomeTodayResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${API_BASE_URL}/home/today`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = payload as { message?: unknown } | null;
        throw new Error(
          typeof error?.message === "string"
            ? error.message
            : "首页暂时无法读取，请重试",
        );
      }
      const parsed = homeTodayResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("首页数据无效，请重试");
      return parsed.data;
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error("连接超时，请检查网络后重试");
      throw error instanceof Error ? error : new Error("无法连接首页服务");
    } finally {
      clearTimeout(timeout);
    }
  },
};
