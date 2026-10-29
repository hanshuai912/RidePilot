# ADR 0003：通用外部 MCP Provider 架构

状态：提议（2026-10-29）

## 背景

RidePilot 需要使用 COROS 官方 MCP 作为训练数据来源，并计划接入其他运动平台。MCP 是工具协议，远程服务的工具名、授权方式和返回结构可能因 Provider 改变。移动端直接连接会暴露授权复杂度，也会让训练领域代码绑定某一厂商。

## 决策

1. 在 NestJS 模块化单体内新增外部集成域；移动端只调用 RidePilot REST API。
2. 以 `McpClientGateway` 封装 Streamable HTTP/SSE、协议协商、OAuth token 注入、超时和 MCP 错误。
3. 以 `ProviderRegistry + ExternalProviderAdapter` 隔离 COROS 及后续 Provider 的 endpoint、工具白名单、schema 和映射逻辑。
4. OAuth 令牌按用户和 Provider 保存，服务端加密；不在客户端保存或转发 token。
5. 先写入 `ExternalActivity` / `ExternalMetricObservation` 规范化读模型，再供训练和 AI 教练读取；不直接覆盖 `TrainingActivity`、训练计划或历史记录。
6. 同步采用异步任务、幂等 upsert、游标/日期范围和可恢复的部分失败状态。
7. 外部写操作与只读同步分离，必须经过提案、校验、预览、确认和幂等执行。
8. 先完成 COROS OAuth 与工具调用兼容性 Spike；如果官方 MCP 不允许第三方 OAuth Client，则转正式 API/合作授权，不使用逆向接口。

## 备选方案

### 移动端直接连接 COROS MCP

放弃。它会把第三方 OAuth、token 生命周期和 MCP 兼容性放到每个客户端，难以保证密钥和用户归属，也无法稳定支撑多 Provider。

### 让 LLM 作为 MCP 中间层

放弃用于数据同步。模型输出不适合作为训练事实来源，无法稳定保证字段、单位、分页和去重。LLM 可以解释已同步的规范化数据，但不负责原始导入。

### 直接使用每家厂商 API

保留为 Provider 的另一种实现方式。若某家没有可用 MCP 或其 MCP 不适合服务端接入，可实现 `ApiProviderAdapter`，复用 connection、sync、normalization 和 UI 契约。

## 后果

- 首次实现需要 OAuth/密钥加密、异步同步和规范化模型，工作量高于把远程结果直接展示给用户。
- 训练域获得稳定的来源和版本边界，后续 Provider 不会扩散到移动端和 AI 代码。
- MCP 工具和 OAuth 的兼容性必须通过真实 Provider Spike 验证，不能只用 SDK mock 宣称 COROS 已接入。
- 数据库需要保存外部来源 ID、同步状态和审计信息；删除、撤销和重新授权必须有明确产品策略。
