# 外部 MCP 接入架构（Planned）

RidePilot 将外部 MCP 当作一种可替换的数据传输协议。移动端只调用 RidePilot API；NestJS 后端拥有 OAuth、MCP Client、Provider Adapter、同步任务和规范化数据。训练、恢复和 AI 模块读取规范化外部数据，不直接依赖 COROS 的工具名、JSON 字段或 MCP 会话。

```text
Mobile -> RidePilot REST API -> Integration domain
                                  -> OAuth / encrypted token store
                                  -> MCP Client Gateway
                                  -> Provider Adapter (COROS, ...)
                                  -> Normalized external read model
                                  -> Training / Coach read contexts
```

### 边界

- MCP gateway 只处理协议、传输、鉴权令牌、超时和工具调用结果。
- Provider Adapter 处理厂商工具白名单、参数、分页和响应映射。
- Normalization/Reconciliation 处理来源、去重、单位、时区和与 RidePilot 计划的匹配。
- 训练域决定哪些数据可以参与教练分析；外部同步不会覆盖人工记录或已完成训练。
- 外部写入必须单独走提案和用户确认，不能从同步或聊天路径直接写入。

具体用户流程、API 草案、数据表和测试门禁见 [外部 MCP 数据接入](../features/external-mcp-data-integration.md)。
