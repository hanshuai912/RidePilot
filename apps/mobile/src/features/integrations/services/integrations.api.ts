import {
  externalConnectionListSchema,
  integrationAuthorizationResponseSchema,
  type ExternalConnection,
  type IntegrationAuthorizationResponse,
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

export class IntegrationsApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new IntegrationsApiError(
        typeof payload?.message === "string"
          ? payload.message
          : "数据源服务请求失败",
        response.status,
        typeof payload?.code === "string" ? payload.code : undefined,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof IntegrationsApiError) throw error;
    throw new IntegrationsApiError(
      controller.signal.aborted ? "连接超时，请稍后重试" : "无法连接数据源服务",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function listConnections(
  accessToken: string,
): Promise<ExternalConnection[]> {
  const parsed = externalConnectionListSchema.safeParse(
    await request<unknown>("me/integrations", accessToken),
  );
  if (!parsed.success)
    throw new IntegrationsApiError("数据源连接数据无效", null);
  return parsed.data;
}

export async function startCorosAuthorization(
  accessToken: string,
): Promise<IntegrationAuthorizationResponse> {
  const parsed = integrationAuthorizationResponseSchema.safeParse(
    await request<unknown>("me/integrations/coros/authorization", accessToken, {
      method: "POST",
    }),
  );
  if (!parsed.success)
    throw new IntegrationsApiError("COROS 授权数据无效", null);
  return parsed.data;
}

export async function disconnectConnection(
  accessToken: string,
  connectionId: string,
): Promise<void> {
  await request(`me/integrations/${connectionId}`, accessToken, {
    method: "DELETE",
  });
}
