# 饮食 API

所有接口前缀为 `/api/v1`，需要 `Authorization: Bearer <access-token>`。写入提案和应用接口应带 `Idempotency-Key`。

## 当前已实现接口

| 方法  | 路径                                                  | 说明                               |
| ----- | ----------------------------------------------------- | ---------------------------------- |
| GET   | `/nutrition/profile`                                  | 查询当前用户饮食档案               |
| PUT   | `/nutrition/profile`                                  | 创建或版本化更新饮食档案           |
| GET   | `/nutrition/plan?date=YYYY-MM-DD`                     | 查询单日正式营养计划               |
| GET   | `/nutrition/plan?from=YYYY-MM-DD&to=YYYY-MM-DD`       | 查询最多 31 天的正式营养计划       |
| POST  | `/nutrition/plans/proposals`                          | 创建完整营养计划草稿               |
| POST  | `/nutrition/plans/generate-proposal`                  | 异步生成 AI 营养计划草稿           |
| GET   | `/nutrition/generations/:id`                          | 查询 AI 营养生成任务               |
| GET   | `/nutrition/races/:id/proposal`                       | 恢复赛事补给方案、草稿或进行中任务 |
| POST  | `/nutrition/training-proposals/:id/generate-proposal` | 根据训练提案生成营养联动草稿       |
| POST  | `/nutrition/races/:id/generate-proposal`              | 根据赛事生成营养联动草稿           |
| POST  | `/nutrition/meal-swap-proposals`                      | 创建餐食替换草稿                   |
| GET   | `/nutrition/proposals/:id`                            | 查询营养提案                       |
| PATCH | `/nutrition/proposals/:id`                            | 修改营养提案草稿                   |
| POST  | `/nutrition/proposals/:id/validate`                   | 重新执行营养安全校验               |
| POST  | `/nutrition/proposals/:id/apply`                      | 确认并应用营养计划版本             |

## 关键规则

- 饮食档案使用固定选项记录饮食习惯、过敏原和禁忌；选择 `OTHER` 时必须填写 `restrictionNote`。
- 已声明过敏原、成分未知的食材会阻断提案应用；低置信度或估算营养值只产生警告。
- 营养计划独立版本化。应用时检查 `expectedNutritionVersion`，旧草稿不能覆盖新版本。
- 正式计划为不可变版本。餐食替换和手动编辑都先形成草稿，经过校验和用户确认后创建新版本。
- 应用在数据库事务中写入计划版本、餐次和提案状态，并检查幂等键。
- AI 营养生成复用 `AiService`、`AiGeneration`、guardrail 和异步轮询；生成结果仍然只创建提案，不直接修改正式计划。
- 训练联动接口读取已通过校验的 AI 训练提案，要求训练基础版本仍然是当前版本；赛事联动接口读取当前用户的赛事。
- 训练提案和营养提案当前分别确认、分别应用；待应用草稿的基础版本过期时必须重新生成，避免旧草稿覆盖新计划。查看已应用方案不会触发生成或再次应用。
- 赛事补给查询返回共享 `RaceNutritionState`：`{ generation, proposal }`，两者可为 `null`。没有可恢复结果时两者都为 `null`；排队/运行中只返回任务；已生成或应用时同时返回任务和提案。赛事不存在或不属于当前用户返回 `404 RACE_NOT_FOUND`。
- 普通赛事生成请求默认恢复已有结果。优先恢复当前正式营养版本对应的赛事已应用方案，其次为有效草稿/任务；已改动赛事之前生成的结果、已过期草稿和基础营养版本过期的草稿不能复用。
- 用户主动点击重新生成时传 `forceRegenerate: true`（适用于 `RACE_LINKED` 及赛事联动请求）。该请求创建新的候选草稿；同场赛事已有显式重新生成任务仍在运行时复用该任务。显式请求的新草稿或任务在查询时优先于旧的已应用方案，以便返回页面继续处理。
- 赛事生成在用户行锁保护的事务内重新查询并决定复用或创建，因此不同幂等键的并发点击不会重复创建同一进行中任务。重新生成不会更改正式计划，仍需通过校验并由用户确认应用。

## 应用请求示例

```http
POST /api/v1/nutrition/proposals/<proposal-id>/apply
Authorization: Bearer <access-token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{"expectedNutritionVersion":0}
```

成功响应包含 `newNutritionVersion` 和 `affectedDates`。版本冲突返回 `409 NUTRITION_VERSION_CONFLICT`；过敏或成分风险返回 `409 NUTRITION_VALIDATION_FAILED`。
