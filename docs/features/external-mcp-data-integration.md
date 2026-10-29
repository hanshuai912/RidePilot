# 外部 MCP 数据接入（设计稿）

状态：Binding implemented；数据同步与 MCP tools 调用仍为 Planned

## 1. 目的与范围

### 解决的问题

RidePilot 需要读取 COROS 等外部运动平台的训练、睡眠和恢复数据，作为训练分析与 AI 教练的输入。接入层还要允许未来增加其他厂商，而不让移动端、训练领域代码依赖某一家厂商的工具名和数据格式。

### V1 设计范围

- 后端以远程 MCP 客户端连接外部服务，移动端只调用 RidePilot API。
- 首个 Provider 设计为 COROS Official MCP，优先支持只读训练记录和基础恢复数据。
- 使用 OAuth 2.1 Authorization Code + PKCE；令牌只保存在服务端。
- 远程 MCP 数据先同步到 RidePilot 的规范化外部数据模型，再参与训练分析。
- 同步任务采用异步状态，支持初次导入、增量同步、失败重试和重新授权。
- 将 Provider 能力声明为统一 capability，后续 Provider 通过注册 Adapter 接入。

### 当前已实现

- NestJS `IntegrationsModule`：COROS Provider 列表、连接状态、OAuth Authorization Code + PKCE、回调、加密 token 保存和解除绑定。
- React Native「我的」页面 COROS 数据卡片：绑定、重新授权、回调恢复、状态展示和解除绑定。
- PostgreSQL 连接、OAuth attempt 和同步运行记录模型已提交 migration。

当前尚未实现远程 MCP `tools/list`、训练数据拉取和规范化活动导入；这些需要先用真实 COROS 账号完成兼容性验证。

### V1 不包含

- 移动端直接连接 MCP 或保存 COROS access token。
- 让 LLM 自主决定调用哪个 MCP 工具来写入正式训练计划。
- 通过自然语言解析未知工具结果后直接写入正式训练记录。
- 用户在 V1 任意填写 MCP URL。服务端只允许注册过的 Provider endpoint，避免 SSRF。
- 未确认兼容性前承诺 COROS 官方 MCP 一定支持 RidePilot 的服务端 OAuth 回调。

## 2. 外部约束与兼容性门禁

COROS 官方现已说明，开发者可以自助构建基于 COROS MCP 的应用，不需要单独申请或审批；应用应实现标准 OAuth 2.0，用户授权后按单用户范围读取自己的数据。RidePilot 仍需验证具体 redirect URI 和动态注册行为，但不应要求用户预先提供固定 client id。

在写入正式业务代码前完成一个只读 Spike：

1. 发现 COROS MCP 的 OAuth 元数据，或按官方网关约定使用动态注册端点。
2. 验证动态客户端注册、Authorization Code + PKCE、redirect URI、scope 和 token refresh。
3. 验证 Streamable HTTP 连接、协议协商、`tools/list` 和至少一个训练记录工具。
4. 记录工具名、输入 schema、`structuredContent`/`content` 响应形状和分页方式。
5. 如果 COROS 只允许官方 Host，停止直接接入，改走 COROS 正式 API、官方合作授权或用户主动上传文件，不把非官方逆向 API 当作替代方案。

## 3. 用户流程

### 3.1 连接数据源

1. 用户进入「设置 → 数据来源 → 添加数据源」。
2. 客户端请求 `GET /api/v1/integrations/providers`，展示 COROS 及其可用数据类型。
3. 用户点击「连接 COROS」，客户端调用 `POST /api/v1/me/integrations/coros/authorization`，服务端创建一次性 `state`、PKCE verifier 和短期授权事务，返回授权 URL。
4. 客户端使用系统浏览器打开授权 URL。用户在 COROS 页面登录并授权。
5. OAuth 回调先到 API。API 校验 `state` 和 PKCE，换取 token，读取远程身份，创建或恢复当前用户的 `ExternalConnection`。
6. API 将回调结果重定向到 RidePilot Universal Link。客户端轮询连接状态，显示「已连接」或明确的重新授权原因。
7. 客户端请求初次同步。用户可选择时间范围，API 返回 `syncRunId`，同步在后台执行。

### 3.2 查看同步状态

数据来源卡片显示：

- 连接状态：未连接、授权中、已连接、同步中、需要重新授权、异常；
- 支持的数据能力；
- 最近同步时间、同步范围和导入数量；
- 最近一次错误及「重试」「重新授权」「断开并删除本地数据」操作。

训练日历和恢复页面读取 RidePilot 的规范化数据，不直接依赖远程 MCP 请求。用户手动刷新时触发增量同步，并显示最近同步时间。

### 3.3 外部写操作

如果某个 Provider 将来支持创建训练计划或训练课程，写操作必须走独立的「外部操作提案」：读取 → 生成候选 → 规则校验 → 差异预览 → 用户确认 → 幂等执行。同步任务和聊天请求永远不能直接调用外部写工具。

## 4. 分层架构

```text
Mobile
  └─ Integration screens/hooks
       └─ RidePilot REST API
            ├─ IntegrationController        路由、鉴权、输入校验
            ├─ ConnectionService             连接状态、归属、幂等
            ├─ OAuthService                  state、PKCE、token refresh
            ├─ SyncService                   同步任务编排和状态机
            ├─ McpClientGateway               MCP transport / JSON-RPC
            ├─ ProviderRegistry              Provider capability 注册
            ├─ CorosProviderAdapter           COROS 工具白名单和解析
            ├─ NormalizationService           统一外部活动/指标模型
            ├─ ReconciliationService          去重、计划课程匹配、冲突
            └─ Repositories                   PostgreSQL / Prisma
```

### 4.1 通用 MCP 层

`McpClientGateway` 只负责协议，不包含训练业务：

- 使用 MCP TypeScript SDK 的 Streamable HTTP transport；保留对 SSE 的兼容边界；
- 连接时处理协议发现/协商、`tools/list`、分页、超时、取消和 `isError`；
- OAuth token 由 `OAuthTokenStore` 提供，网关不向移动端返回 token；
- 对 endpoint、工具名、输入大小、响应大小和请求耗时执行限制；
- 工具结果优先读取 `structuredContent`，没有结构化结果时交给 Provider Adapter 处理，不能把任意文本当成可信训练数据；
- 不接受用户传入的任意 URL，不执行 stdio 子进程。V1 只支持服务端注册的 HTTPS Provider。

### 4.2 Provider Registry 与 Adapter

每个 Provider 包含以下声明：

```ts
type ExternalProviderDefinition = {
  key: string;
  displayName: string;
  transport: "streamable-http" | "sse";
  endpoint: string;
  auth: "oauth2-pkce" | "api-key";
  capabilities: ExternalCapability[];
  allowedTools: string[];
  adapterVersion: string;
};

type ExternalCapability =
  | "profile.read"
  | "activities.read"
  | "activity.detail.read"
  | "health.daily.read"
  | "sleep.read"
  | "recovery.read"
  | "training-plan.read"
  | "training-plan.write"
  | "workout.write";
```

Adapter 不把 COROS 工具名暴露到训练模块，而是实现统一端口：

```ts
interface ExternalProviderAdapter {
  readonly providerKey: string;
  discoverAccount(client: McpClientPort): Promise<ExternalAccount>;
  listActivities(
    client: McpClientPort,
    query: ActivityQuery,
  ): Promise<ExternalActivityPage>;
  getActivityDetail?(
    client: McpClientPort,
    externalId: string,
  ): Promise<ExternalActivityDetail>;
  listRecovery?(
    client: McpClientPort,
    query: RecoveryQuery,
  ): Promise<ExternalRecoveryPage>;
}
```

COROS Adapter 只允许已审查的工具名和参数。工具名变更、响应 schema 变更或 endpoint 变更时提升 `adapterVersion`，旧连接进入 `DEGRADED`，不会静默导入错误数据。

## 5. 数据模型设计

### 5.1 连接与授权

建议新增以下模型，字段名为设计稿，实施时写入 Prisma migration：

`ExternalConnection`

- `id`, `userId`, `providerKey`, `status`, `serverUrl`；
- `providerAccountId`, `providerAccountLabel`, `scopes`；
- `accessTokenCiphertext`, `refreshTokenCiphertext`, `tokenExpiresAt`；
- `adapterVersion`, `lastSyncedAt`, `version`, `createdAt`, `updatedAt`；
- 唯一约束：`(userId, providerKey, providerAccountId)`；
- 索引：`(userId, status)`、`(tokenExpiresAt)`。

`OAuthAuthorizationAttempt`

- `id`, `userId`, `providerKey`, `stateHash`, `codeVerifierCiphertext`；
- `redirectUri`, `expiresAt`, `consumedAt`, `createdAt`；
- `stateHash` 唯一，过期后不能使用。

`ExternalSyncRun`

- `id`, `connectionId`, `kind`, `status`, `requestedFrom`, `requestedTo`；
- `cursor`, `itemsSeen`, `itemsImported`, `itemsUpdated`, `itemsSkipped`；
- `errorCode`, `requestId`, `startedAt`, `finishedAt`, `idempotencyKey`；
- 唯一约束：`(connectionId, idempotencyKey)`。

### 5.2 规范化数据

第一版不把所有厂商字段硬塞进 `TrainingActivity`。先保存带来源标识的规范化读模型：

`ExternalActivity`

- `userId`, `connectionId`, `providerKey`, `externalId`；
- `activityType`, `startedAt`, `endedAt`, `localDate`, `timezone`；
- `durationSec`, `distanceM`, `elevationGainM`, `caloriesKcal`；
- `avgHeartRateBpm`, `avgPowerW`, `normalizedPayload`；
- `providerUpdatedAt`, `importedAt`, `checksum`；
- 唯一约束：`(connectionId, externalId)`；
- 索引：`(userId, startedAt)`、`(userId, activityType, startedAt)`。

`ExternalMetricObservation`

- `userId`, `connectionId`, `providerKey`, `metricType`, `metricDate`；
- `value`, `unit`, `seriesPayload`, `providerUpdatedAt`, `checksum`；
- 唯一约束：`(connectionId, metricType, metricDate, providerUpdatedAt)`。

规范化模型保留 `normalizedPayload` 作为受控扩展字段，但训练规则只能读取明确映射过的字段。完整原始响应默认不长期保存；如为诊断短期保存，必须加密、设 TTL，并从日志中排除。

### 5.3 与现有训练域的关系

- `ExternalActivity` 是外部事实；`TrainingActivity` 是 RidePilot 训练反馈/完成记录，两者不互相覆盖。
- `ReconciliationService` 可以根据时间、类型和计划课程生成匹配建议；自动匹配必须有确定条件，模糊匹配只显示给用户确认。
- 已有人工记录、已完成训练和正式计划版本不可被同步覆盖。
- `AbilityMeasurement`、恢复状态和 AI 上下文只读取经过映射、去重和来源标注的规范化记录。

## 6. API 契约草案

所有接口前缀为 `/api/v1`，需要 RidePilot JWT；资源按当前用户隔离。

| Method | Path                                       | 作用                                          |
| ------ | ------------------------------------------ | --------------------------------------------- |
| GET    | `/integrations/providers`                  | 列出可用 Provider、能力、连接要求             |
| GET    | `/me/integrations`                         | 当前用户的连接和同步状态                      |
| POST   | `/me/integrations/:provider/authorization` | 创建 OAuth 授权事务，返回授权 URL             |
| GET    | `/integrations/oauth/callback/:provider`   | 校验 state/PKCE，完成授权回调                 |
| GET    | `/me/integrations/:connectionId`           | 查看连接详情和能力                            |
| DELETE | `/me/integrations/:connectionId`           | 撤销远端授权并删除/保留本地数据（需显式选项） |
| POST   | `/me/integrations/:connectionId/probe`     | 使用 token 探测 MCP initialize 和 tools/list  |
| POST   | `/me/integrations/:connectionId/sync`      | 创建幂等同步任务                              |
| GET    | `/me/integrations/sync-runs/:syncRunId`    | 查询同步状态和错误                            |
| GET    | `/me/external-activities`                  | 查询规范化外部训练记录                        |
| GET    | `/me/external-metrics`                     | 查询规范化健康/恢复指标                       |

创建授权响应示例：

```json
{
  "provider": "coros",
  "authorizationUrl": "https://...",
  "authorizationAttemptId": "uuid",
  "expiresAt": "2026-10-29T10:00:00.000Z"
}
```

同步请求示例：

```json
{
  "from": "2026-08-01",
  "to": "2026-10-29",
  "mode": "incremental"
}
```

返回 `202` 和 `syncRunId`。同步状态至少包含 `QUEUED`、`RUNNING`、`SUCCEEDED`、`PARTIAL`、`FAILED`、`REAUTH_REQUIRED`。

## 7. 同步流程与一致性

1. Controller 校验 JWT、connection 所属用户、日期范围和 `Idempotency-Key`。
2. `SyncService` 在事务内创建或复用 `ExternalSyncRun`，随后由带租约的 worker 执行；沿用现有 AI worker 的 PostgreSQL 租约模式，首版不新增队列基础设施。
3. Worker 获取有效 access token；接近过期时用 refresh token 原子刷新。刷新失败将连接标记为 `REAUTH_REQUIRED`。
4. Adapter 按 capability 调用允许的 MCP 工具，按 provider 分页和限额读取。
5. 每条结果以 `(connectionId, externalId)` 幂等 upsert；checksum 未变化时跳过更新。
6. 规范化失败只标记该条记录并继续可恢复项目，最终状态为 `PARTIAL`，不回滚已确认导入的数据。
7. 同步完成后失效 TanStack Query 的数据来源、日历和恢复相关缓存，并记录审计事件。

## 8. 安全、隐私与错误处理

- access token、refresh token 使用服务端密钥加密存储；环境变量只保存加密主密钥引用，不把令牌写入日志、错误响应或移动端。
- OAuth 使用一次性 state、PKCE、短过期时间和严格 redirect URI；回调不接受客户端传来的 userId。
- Provider endpoint 使用服务端 allowlist；禁止把用户可控 URL 交给 HTTP 客户端，防止 SSRF。
- MCP 工具采用 allowlist；只读同步路径拒绝 `*.write` capability，写操作必须经过独立确认流程。
- 为远程请求设置连接/读取超时、响应体大小上限、重试次数和按用户/Provider 限流。
- 日志记录 provider、connectionId、syncRunId、tool name、耗时和错误码；不记录 token、完整健康数据或原始响应。
- 断开连接提供两种明确选项：撤销远端授权并保留 RidePilot 历史，或同时删除本地外部数据。删除操作使用事务和审计记录。
- 所有跨用户查询都以 JWT 的 `userId` 加 connection 所有权过滤；连接版本用于处理并发断开、重连和同步。

## 9. 客户端状态与交互

移动端新增 `features/integrations/`，建议拆分：

- `screens/DataSourcesScreen.tsx`：Provider 列表、连接状态和同步入口；
- `components/ProviderCard.tsx`：能力、最近同步、错误状态；
- `components/SyncRangeSheet.tsx`：初次导入时间范围；
- `hooks/useExternalConnections.ts`、`useConnectProvider.ts`、`useSyncProvider.ts`；
- `services/integrations.api.ts`：只调用 RidePilot REST API；
- `model/integration-view-model.ts`：把后端状态映射为中文 UI 文案。

必须覆盖的 UI 状态：加载、未连接、授权中、需要重新授权、同步中、部分成功、完全失败、空数据和成功刷新。OAuth 回调回到 App 后不要把 token 放入路由参数；客户端只根据 attempt/connection 状态重新查询。

## 10. 测试与验收

### Spike 验收

- COROS 发现、OAuth、PKCE、token refresh 和远程 MCP transport 能完成；不使用逆向 API。
- 可以列出工具并调用一个只读训练工具；记录稳定的输入/输出 fixture。
- 明确 endpoint、scope、分页、速率限制和错误码，若不满足则形成阻断记录。

### 后端测试

- Provider registry 只暴露 allowlist endpoint/tool；未知 Provider 和未知工具被拒绝。
- OAuth state 重放、错误用户回调、过期 verifier、错误 redirect URI 返回明确错误。
- connection 所有权、断开、重连、token refresh 和 `REAUTH_REQUIRED`。
- 同步幂等、分页、部分失败、超时、重试、版本冲突和并发租约。
- 同一个外部记录重复同步不产生重复行；人工/已完成训练记录不被覆盖。
- `structuredContent` schema 错误或文本结果不可信时，不写入规范化训练字段。

### 移动端测试

- 连接、回调恢复、重新授权、同步轮询、失败重试和空数据状态；
- 不在 API 请求、导航参数或崩溃日志中出现 token；
- 同一连接状态被 Query 缓存正确失效，切换页面后不显示旧的同步状态。

## 11. 实施顺序

1. **兼容性 Spike**：只读命令行/测试脚本，不写业务表。
2. **通用基础设施**：Provider registry、OAuth attempt、connection、MCP gateway、加密 token store。
3. **COROS 只读闭环**：连接、近 14/30 天训练同步、状态页面和规范化活动列表。
4. **训练域接入**：恢复/睡眠指标，读取来源标记，接入 CoachDataService 的只读上下文。
5. **增量同步与可观测性**：租约、幂等、指标、审计和重新授权。
6. **第二个 Provider**：用另一种认证或工具 schema 验证通用 Adapter 边界。
7. **外部写操作**：只有在用户确认、提案和幂等执行链路稳定后再开放。

## 12. 未决问题

- COROS 官方 MCP 是否允许 RidePilot 的 OAuth client 注册及服务端回调；以 Spike 结果为准。
- 是否需要将 `.fit` 文件放入对象存储，还是只保存解析后的规范化指标。
- 首次同步默认时间范围和单次最大记录数。
- 外部训练记录何时、以什么确定规则映射到现有计划课程。
- 断开连接时默认保留还是删除本地历史；需要产品确认。
