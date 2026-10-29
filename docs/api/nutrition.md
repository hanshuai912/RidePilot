# 饮食 API

所有接口前缀为 `/api/v1`，需要 `Authorization: Bearer <access-token>`。写入提案和应用接口应带 `Idempotency-Key`。

## 当前已实现接口

| 方法  | 路径                                                  | 说明                         |
| ----- | ----------------------------------------------------- | ---------------------------- |
| GET   | `/nutrition/profile`                                  | 查询当前用户饮食档案         |
| PUT   | `/nutrition/profile`                                  | 创建或版本化更新饮食档案     |
| GET   | `/nutrition/plan?date=YYYY-MM-DD`                     | 查询单日正式营养计划         |
| GET   | `/nutrition/plan?from=YYYY-MM-DD&to=YYYY-MM-DD`       | 查询最多 31 天的正式营养计划 |
| POST  | `/nutrition/plans/proposals`                          | 创建完整营养计划草稿         |
| POST  | `/nutrition/plans/generate-proposal`                  | 异步生成 AI 营养计划草稿     |
| GET   | `/nutrition/generations/:id`                          | 查询 AI 营养生成任务         |
| POST  | `/nutrition/training-proposals/:id/generate-proposal` | 根据训练提案生成营养联动草稿 |
| POST  | `/nutrition/races/:id/generate-proposal`              | 根据赛事生成营养联动草稿     |
| POST  | `/nutrition/meal-swap-proposals`                      | 创建餐食替换草稿             |
| GET   | `/nutrition/proposals/:id`                            | 查询营养提案                 |
| PATCH | `/nutrition/proposals/:id`                            | 修改营养提案草稿             |
| POST  | `/nutrition/proposals/:id/validate`                   | 重新执行营养安全校验         |
| POST  | `/nutrition/proposals/:id/apply`                      | 确认并应用营养计划版本       |

## 关键规则

- 饮食档案使用固定选项记录饮食习惯、过敏原和禁忌；选择 `OTHER` 时必须填写 `restrictionNote`。
- 已声明过敏原、成分未知的食材会阻断提案应用；低置信度或估算营养值只产生警告。
- 营养计划独立版本化。应用时检查 `expectedNutritionVersion`，旧草稿不能覆盖新版本。
- 正式计划为不可变版本。餐食替换和手动编辑都先形成草稿，经过校验和用户确认后创建新版本。
- 应用在数据库事务中写入计划版本、餐次和提案状态，并检查幂等键。
- AI 营养生成复用 `AiService`、`AiGeneration`、guardrail 和异步轮询；生成结果仍然只创建提案，不直接修改正式计划。
- 训练联动接口读取已通过校验的 AI 训练提案，要求训练基础版本仍然是当前版本；赛事联动接口读取当前用户的赛事。
- 训练提案和营养提案当前分别确认、分别应用；任一版本发生变化都必须重新生成，避免旧草稿覆盖新计划。

## 应用请求示例

```http
POST /api/v1/nutrition/proposals/<proposal-id>/apply
Authorization: Bearer <access-token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{"expectedNutritionVersion":0}
```

成功响应包含 `newNutritionVersion` 和 `affectedDates`。版本冲突返回 `409 NUTRITION_VERSION_CONFLICT`；过敏或成分风险返回 `409 NUTRITION_VALIDATION_FAILED`。
