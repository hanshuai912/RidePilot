# 饮食 API

教练中心通过本人建议列表恢复饮食/赛事补给草稿。应用请求支持可选 `expectedProposalVersion`：与预览版本不一致返回 `409 PROPOSAL_VERSION_CONFLICT`，已应用重复请求仍返回原结果。正式饮食版本、领域校验和幂等语义保留。

所有接口前缀为 `/api/v1`，需要 `Authorization: Bearer <access-token>`。写入提案和应用接口应带 `Idempotency-Key`。

## 当前已实现接口

| 方法  | 路径                                                     | 说明                                                  |
| ----- | -------------------------------------------------------- | ----------------------------------------------------- |
| GET   | `/nutrition/profile`                                     | 查询当前用户饮食档案                                  |
| PUT   | `/nutrition/profile`                                     | 创建或版本化更新饮食档案                              |
| GET   | `/nutrition/plan?date=YYYY-MM-DD`                        | 查询单日正式营养计划                                  |
| GET   | `/nutrition/plan?from=YYYY-MM-DD&to=YYYY-MM-DD`          | 查询最多 31 天的正式营养计划                          |
| POST  | `/nutrition/plans/proposals`                             | 创建完整营养计划草稿                                  |
| POST  | `/nutrition/plans/generate-proposal`                     | 异步生成 AI 营养计划草稿                              |
| GET   | `/nutrition/generations/:id`                             | 查询 AI 营养生成任务                                  |
| GET   | `/nutrition/races/:id/proposal`                          | 恢复赛事补给方案、草稿或进行中任务                    |
| POST  | `/nutrition/training-proposals/:id/generate-proposal`    | 根据训练提案生成营养联动草稿                          |
| POST  | `/nutrition/races/:id/generate-proposal`                 | 根据赛事生成营养联动草稿                              |
| GET   | `/nutrition/training-link?from=YYYY-MM-DD&to=YYYY-MM-DD` | 读取训练补给待核对日期与已有草稿/任务                 |
| POST  | `/nutrition/item-edit-proposals`                         | 精确编辑一个正式餐次的份量和时间，创建 ITEM_EDIT 草稿 |
| POST  | `/nutrition/meal-swap-proposals`                         | 创建餐食替换草稿                                      |
| GET   | `/nutrition/proposals/:id`                               | 查询营养提案                                          |
| PATCH | `/nutrition/proposals/:id`                               | 修改营养提案草稿                                      |
| POST  | `/nutrition/proposals/:id/validate`                      | 重新执行营养安全校验                                  |
| POST  | `/nutrition/proposals/:id/apply`                         | 确认并应用营养计划版本                                |

## 关键规则

- 饮食档案使用固定选项记录饮食习惯、过敏原和禁忌；选择 `OTHER` 时必须填写 `restrictionNote`。
- 已声明过敏原、成分未知的食材会阻断提案应用；低置信度或估算营养值只产生警告。
- 营养计划独立版本化。应用时检查 `expectedNutritionVersion`，旧草稿不能覆盖新版本。
- 正式计划为不可变版本。餐食替换和手动编辑都先形成草稿，经过校验和用户确认后创建新版本。
- 应用在数据库事务中写入计划版本、餐次和提案状态，并检查幂等键。
- AI 营养生成复用 `AiService`、`AiGeneration`、guardrail 和异步轮询；生成结果仍然只创建提案，不直接修改正式计划。
- 训练联动可不传 workoutId / trainingProposalId，直接按范围读取最新正式训练（包括休息日）；必须传 expectedTrainingPlanVersion。指定 AI 训练提案时，READY 比较 baseVersionId，APPLIED 比较 appliedVersionId；预览未应用训练产生的补给不能直接应用，需先应用训练再重新生成。赛事联动接口读取当前用户的赛事。
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

## 训练与补给联动

`GET /nutrition/training-link` 支持 `date` 或 `from/to`，范围 1–31 天；响应为共享 `TrainingNutritionState`：

```json
{
  "from": "2030-01-01",
  "to": "2030-01-07",
  "trainingPlanVersion": 4,
  "nutritionVersion": 2,
  "affectedDates": ["2030-01-01"],
  "generation": null,
  "proposal": null
}
```

`affectedDates` 表示尚未按当前训练核对过，或训练内容与最近已确认联动依据不同的日期。首次接入的历史营养计划没有核对记录，所选范围显示待核对；不表示检测出营养不足。查询绝不创建任务。

显式生成使用现有 `POST /nutrition/plans/generate-proposal`：`mode: TRAINING_LINKED`、`startDate/endDate`、`expectedTrainingPlanVersion`、`expectedNutritionVersion`；不要求存在课程，长骑被删除后可按最新休息安排生成。普通请求恢复当前训练版本、日期范围、营养基础版本匹配的草稿/任务或当前已应用方案。`forceRegenerate: true` 创建新候选；已有相同范围的运行中任务仍复用。事务内锁用户行防重复创建。失败/过期/基于旧版本的结果不复用。

模型返回时重新检查训练和营养版本，返回范围必须与请求一致；草稿保存范围内的原餐次，供完整差异预览。联动提案 metadata 中的可选 `trainingContext` 保存 `planVersionId`、`planVersion` 和逐日训练内容摘要。应用事务再次检查训练版本；发生变化返回 `409 PLAN_VERSION_CONFLICT`。营养版本仍按原规则检查。

应用仅替换草稿覆盖范围的餐次，保留范围外正式餐次和核对记录；`affectedDates` 覆盖整个替换日期范围（含移除餐次日期）。重复应用返回第一次的版本及影响日期。历史版本保留。

`POST /nutrition/item-edit-proposals` 请求：`{ itemId, expectedNutritionVersion, scheduledLocalTime: "09:30", amounts: [100, 200] }`。amounts 与原餐次食物顺序一一对应，保留原食物、单位、过敏原和成分状态；变更份量后营养值置为 null，并标为 USER_ENTERED / LOW。按餐次 ID 精确修改，不会误改同日同时间同餐型的另一餐。创建后必须 validate，再 apply。错误包括 404 NUTRITION_ITEM_NOT_FOUND、409 NUTRITION_VERSION_CONFLICT、400 NUTRITION_AMOUNTS_INVALID。

编辑联动草稿复用 PATCH，携带 expectedProposalVersion；不允许改变覆盖起止日期，修改后重置为 DRAFT，必须重新校验。其他日期范围请重新生成。

## 营养草稿生命周期（2026-11-05）

INITIAL/REGENERATE 同样按完整请求与当前上下文复用已有任务/有效草稿；显式 `forceRegenerate:true` 创建新候选，运行中的相同任务仍恢复。RACE_LINKED/TRAINING_LINKED 保留原有已应用方案恢复和显式重新生成行为。只有新候选无 blockers 时才替代同任务范围旧候选，FAILED/BLOCKED 均保留原候选。旧候选 EXPIRED 并增加 proposalVersion；服务端拒绝重新应用。

新 AI 提案 metadata 可含 `generationContext:{fingerprint,profileVersion,nutritionProfileVersion,trainingPlanVersionId,raceId?,raceVersion?}`。提交前后比较完整上下文，改变时任务失败 `GENERATION_CONTEXT_CHANGED`。应用重查快照，资料或赛事改变返回409 NUTRITION_GENERATION_STALE；训练联动已有 PLAN_VERSION_CONFLICT 语义保留。到期应用返回409 PROPOSAL_EXPIRED。无新增迁移；接口和客户端契约同步更新。

## 取消生成（2026-11-10）

`POST /nutrition/generations/:id/cancel`：Bearer 登录，UUID，无请求体。只允许本人 `NUTRITION_PLAN` 的 QUEUED/RUNNING 任务取消，返回 200 生成响应，状态为 CANCELLED；重复取消幂等成功。非本人、不存在或其他生成场景返回 404，已结束任务返回 409 `GENERATION_NOT_CANCELLABLE`。轮询接口也可返回 CANCELLED，客户端应停止等待，重新生成使用新幂等键。见 [取消生成功能](../features/ai-generation-cancellation.md)。
