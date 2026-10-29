import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { env } from "../../config/env";
import { IntegrationCryptoService } from "./integration-crypto.service";
import {
  COROS_CAPABILITIES,
  type ProviderDefinition,
} from "./integration.types";

type OAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type OAuthClientRegistrationResponse = {
  client_id?: string;
};

type McpBody = {
  error?: unknown;
  result?: {
    protocolVersion?: unknown;
    serverInfo?: unknown;
    tools?: unknown[];
  };
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: IntegrationCryptoService,
  ) {}

  listProviders() {
    const provider = this.corosProvider();
    return [
      {
        key: provider.key,
        displayName: provider.displayName,
        status: provider.configured ? "AVAILABLE" : "CONFIGURATION_REQUIRED",
        capabilities: [...provider.capabilities],
      },
    ];
  }

  async listConnections(userId: string) {
    const connections = await this.prisma.externalConnection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return connections.map((connection) => ({
      id: connection.id,
      providerKey: connection.providerKey,
      displayName:
        connection.providerKey === "coros" ? "COROS" : connection.providerKey,
      status: connection.status,
      providerAccountLabel: connection.providerAccountLabel,
      capabilities: [...COROS_CAPABILITIES],
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      updatedAt: connection.updatedAt.toISOString(),
    }));
  }

  async createAuthorization(userId: string, providerKey: string) {
    const provider = this.provider(providerKey);
    if (!provider.configured)
      throw new ServiceUnavailableException({
        code: "INTEGRATION_NOT_CONFIGURED",
        message: "COROS MCP 地址配置无效",
      });

    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const oauthIssuer = new URL(env.COROS_MCP_URL).origin;
    const oauthClientId = await this.registerOAuthClient(
      oauthIssuer,
      env.COROS_OAUTH_REDIRECT_URI,
    );
    const connection = await this.prisma.externalConnection.upsert({
      where: { userId_providerKey: { userId, providerKey } },
      create: { userId, providerKey, status: "AUTHORIZING" },
      update: { status: "AUTHORIZING", version: { increment: 1 } },
    });
    await this.prisma.externalConnection.update({
      where: { id: connection.id },
      data: { oauthClientId, oauthIssuer },
    });
    const attempt = await this.prisma.oAuthAuthorizationAttempt.create({
      data: {
        userId,
        connectionId: connection.id,
        providerKey,
        oauthClientId,
        oauthIssuer,
        stateHash: this.crypto.hash(state),
        codeVerifierCiphertext: this.crypto.encrypt(codeVerifier),
        redirectUri: env.COROS_OAUTH_REDIRECT_URI,
        appRedirectUri: env.INTEGRATION_APP_REDIRECT_URI,
        expiresAt,
      },
    });
    const url = new URL(`${oauthIssuer}/oauth2/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", oauthClientId);
    url.searchParams.set("redirect_uri", env.COROS_OAUTH_REDIRECT_URI);
    url.searchParams.set("scope", env.COROS_OAUTH_SCOPE);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("resource", env.COROS_MCP_URL);
    return {
      providerKey,
      authorizationAttemptId: attempt.id,
      authorizationUrl: url.toString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async handleCallback(
    providerKey: string,
    query: { code?: string; state?: string; error?: string },
  ) {
    const appRedirect = new URL(env.INTEGRATION_APP_REDIRECT_URI);
    appRedirect.searchParams.set("provider", providerKey);
    if (query.error) {
      appRedirect.searchParams.set("status", "error");
      appRedirect.searchParams.set("code", "OAUTH_DENIED");
      return appRedirect.toString();
    }
    if (!query.code || !query.state) {
      appRedirect.searchParams.set("status", "error");
      appRedirect.searchParams.set("code", "OAUTH_CALLBACK_INVALID");
      return appRedirect.toString();
    }
    const attempt = await this.prisma.oAuthAuthorizationAttempt.findFirst({
      where: {
        providerKey,
        stateHash: this.crypto.hash(query.state),
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!attempt) {
      appRedirect.searchParams.set("status", "error");
      appRedirect.searchParams.set("code", "OAUTH_STATE_INVALID");
      return appRedirect.toString();
    }
    const claimed = await this.prisma.oAuthAuthorizationAttempt.updateMany({
      where: { id: attempt.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (!claimed.count) {
      appRedirect.searchParams.set("status", "error");
      appRedirect.searchParams.set("code", "OAUTH_STATE_REPLAYED");
      return appRedirect.toString();
    }
    try {
      const verifier = this.crypto.decrypt(attempt.codeVerifierCiphertext);
      const token = await this.exchangeCode(
        query.code,
        verifier,
        attempt.redirectUri,
        attempt.oauthClientId,
        attempt.oauthIssuer,
      );
      const connection = await this.prisma.externalConnection.update({
        where: { id: attempt.connectionId! },
        data: {
          status: "CONNECTED",
          accessTokenCiphertext: this.crypto.encrypt(token.access_token!),
          refreshTokenCiphertext: token.refresh_token
            ? this.crypto.encrypt(token.refresh_token)
            : null,
          tokenExpiresAt: token.expires_in
            ? new Date(Date.now() + token.expires_in * 1000)
            : null,
          scopes: token.scope?.split(" ") ?? env.COROS_OAUTH_SCOPE.split(" "),
          providerAccountLabel: "COROS",
          version: { increment: 1 },
        },
      });
      appRedirect.searchParams.set("status", "success");
      appRedirect.searchParams.set("connectionId", connection.id);
    } catch {
      if (attempt.connectionId) {
        await this.prisma.externalConnection.update({
          where: { id: attempt.connectionId },
          data: { status: "FAILED", version: { increment: 1 } },
        });
      }
      appRedirect.searchParams.set("status", "error");
      appRedirect.searchParams.set("code", "OAUTH_TOKEN_EXCHANGE_FAILED");
    }
    return appRedirect.toString();
  }

  async disconnect(userId: string, connectionId: string) {
    const connection = await this.prisma.externalConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection)
      throw new NotFoundException({
        code: "INTEGRATION_NOT_FOUND",
        message: "数据源连接不存在",
      });
    await this.prisma.externalConnection.delete({
      where: { id: connection.id },
    });
    return { success: true };
  }

  async probe(userId: string, connectionId: string) {
    const connection = await this.prisma.externalConnection.findFirst({
      where: { id: connectionId, userId, providerKey: "coros" },
    });
    if (!connection) {
      throw new NotFoundException({
        code: "INTEGRATION_NOT_FOUND",
        message: "数据源连接不存在",
      });
    }
    if (!connection.accessTokenCiphertext) {
      throw new BadRequestException({
        code: "INTEGRATION_NOT_AUTHORIZED",
        message: "数据源尚未完成授权",
      });
    }
    const accessToken = this.crypto.decrypt(connection.accessTokenCiphertext);
    const initialize = await this.mcpRequest(accessToken, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "ridepilot", version: "0.1.0" },
      },
    });
    const tools = await this.mcpRequest(
      accessToken,
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      initialize.sessionId,
    );
    const toolList = Array.isArray(tools.body?.result?.tools)
      ? tools.body.result.tools
          .filter((tool: unknown): tool is Record<string, unknown> =>
            Boolean(tool && typeof tool === "object"),
          )
          .map((tool) => ({
            name: typeof tool.name === "string" ? tool.name : "unknown",
            description:
              typeof tool.description === "string" ? tool.description : null,
          }))
      : [];
    return {
      providerKey: "coros",
      endpoint: env.COROS_MCP_URL,
      protocolVersion: initialize.body?.result?.protocolVersion ?? null,
      serverInfo: initialize.body?.result?.serverInfo ?? null,
      tools: toolList,
    };
  }

  private corosProvider(): ProviderDefinition {
    return {
      key: "coros",
      displayName: "COROS",
      capabilities: COROS_CAPABILITIES,
      configured: Boolean(new URL(env.COROS_MCP_URL)),
    };
  }

  private provider(providerKey: string): ProviderDefinition {
    if (providerKey !== "coros") {
      throw new BadRequestException({
        code: "UNSUPPORTED_INTEGRATION",
        message: "暂不支持该数据源",
      });
    }
    return this.corosProvider();
  }

  private async exchangeCode(
    code: string,
    verifier: string,
    redirectUri: string,
    clientId: string,
    oauthIssuer: string,
  ) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const response = await fetch(`${oauthIssuer}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response
      .json()
      .catch(() => null)) as OAuthTokenResponse | null;
    if (!response.ok || !payload?.access_token)
      throw new Error("OAuth token exchange failed");
    return payload;
  }

  private async registerOAuthClient(issuer: string, redirectUri: string) {
    const response = await fetch(`${issuer}/connect/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "RidePilot",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: env.COROS_OAUTH_SCOPE,
        token_endpoint_auth_method: "none",
      }),
    });
    const payload = (await response
      .json()
      .catch(() => null)) as OAuthClientRegistrationResponse | null;
    if (!response.ok || !payload?.client_id) {
      throw new ServiceUnavailableException({
        code: "COROS_OAUTH_REGISTRATION_FAILED",
        message: "COROS MCP 动态 OAuth 注册失败",
      });
    }
    return payload.client_id;
  }

  private async mcpRequest(
    accessToken: string,
    payload: Record<string, unknown>,
    sessionId?: string,
  ) {
    const response = await fetch(env.COROS_MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      },
      body: JSON.stringify(payload),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    const body = this.parseMcpBody(raw, contentType);
    if (!response.ok || body?.error) {
      throw new ServiceUnavailableException({
        code: "MCP_REQUEST_FAILED",
        message: "COROS MCP 请求失败",
      });
    }
    return {
      body,
      sessionId: response.headers.get("mcp-session-id") ?? sessionId,
    };
  }

  private parseMcpBody(raw: string, contentType: string): McpBody {
    if (contentType.includes("text/event-stream")) {
      const dataLines = raw
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);
      const last = dataLines.at(-1);
      if (!last) {
        throw new ServiceUnavailableException({
          code: "MCP_EMPTY_RESPONSE",
          message: "COROS MCP 返回为空",
        });
      }
      return JSON.parse(last) as McpBody;
    }
    return JSON.parse(raw) as McpBody;
  }
}
