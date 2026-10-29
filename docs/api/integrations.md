# 外部数据源 API（COROS 绑定）

状态：Binding implemented；同步接口 Planned

所有受保护接口使用 `Authorization: Bearer <access-token>`。OAuth 回调是唯一公开接口，服务端只把结果通过 App deep link 返回，不返回 access token。

| Method | Path                                          | 权限   | 作用                                               |
| ------ | --------------------------------------------- | ------ | -------------------------------------------------- |
| GET    | `/api/v1/integrations/providers`              | JWT    | 查看已注册 Provider 及配置状态                     |
| GET    | `/api/v1/me/integrations`                     | JWT    | 查看当前用户连接                                   |
| POST   | `/api/v1/me/integrations/coros/authorization` | JWT    | 创建 OAuth state/PKCE 并返回授权 URL               |
| GET    | `/api/v1/integrations/oauth/callback/coros`   | Public | 校验 state、交换 token、重定向回 App               |
| POST   | `/api/v1/me/integrations/:connectionId/probe` | JWT    | 调用 MCP `initialize` 和 `tools/list` 做兼容性探测 |
| DELETE | `/api/v1/me/integrations/:connectionId`       | JWT    | 解除当前用户的连接                                 |

## 授权启动

```http
POST /api/v1/me/integrations/coros/authorization
Authorization: Bearer <access-token>
```

```json
{
  "providerKey": "coros",
  "authorizationAttemptId": "uuid",
  "authorizationUrl": "https://provider.example/oauth/authorize?...",
  "expiresAt": "2026-10-29T10:00:00.000Z"
}
```

客户端使用系统浏览器打开 `authorizationUrl`。OAuth 提供方回调到服务端配置的 `COROS_OAUTH_REDIRECT_URI`，服务端校验一次性 state 和 PKCE verifier 后，将结果重定向到 `INTEGRATION_APP_REDIRECT_URI`，例如：

```text
ridepilot://coros-callback?provider=coros&status=success&connectionId=<uuid>
```

失败只返回有限错误码，例如 `OAUTH_STATE_INVALID`、`OAUTH_DENIED` 或 `OAUTH_TOKEN_EXCHANGE_FAILED`，不返回上游 token 响应。

## 兼容性探测

```http
POST /api/v1/me/integrations/:connectionId/probe
Authorization: Bearer <access-token>
```

服务端使用加密保存的 access token 请求 `COROS_MCP_URL`，发送 MCP `initialize` 和 `tools/list`，返回协议版本、服务器信息和工具名称。不会把 token 或完整工具 schema 写入日志。

如果远程服务返回 SSE，服务端解析最后一个 `data:` JSON 事件；如果返回 JSON-RPC error，接口返回 `MCP_REQUEST_FAILED`。

## 环境变量

参见 `apps/api/.env.example`：

- `COROS_MCP_URL`
- `COROS_OAUTH_REDIRECT_URI`
- `INTEGRATION_APP_REDIRECT_URI`
- `MCP_TOKEN_ENCRYPTION_KEY`

COROS MCP 使用动态 OAuth 客户端注册，服务端会向 `${issuer}/connect/register` 注册一次性 public client，再使用 `${issuer}/oauth2/authorize` 和 `${issuer}/oauth2/token` 完成授权。通常不需要申请或手动填写 `client_id`、`client_secret`。

生产环境必须配置 `MCP_TOKEN_ENCRYPTION_KEY`。当前开发环境未配置时会使用进程级临时密钥，API 重启后已保存的测试 token 无法解密。
