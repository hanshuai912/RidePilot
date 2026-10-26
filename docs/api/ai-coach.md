# AI 教练 API

所有路径前缀为 `/api/v1`，需要 `Authorization: Bearer <access-token>`。写入型生成和应用请求应带独立的 `Idempotency-Key`。请求体与响应结构以 `packages/contracts/src/coach.ts` 的 Zod schema 为准。

| 方法               | 路径                                              | 作用                                                            |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------- |
| GET / POST         | `/me/ability-measurements/ftp`                    | 查询最新 FTP / 追加一次 FTP 测量                                |
| GET / PUT          | `/me/availability`                                | 查询 / 保存每周可训练时间；更新传 `expectedVersion`             |
| GET / POST / PATCH | `/goals`、`/goals/:id`                            | 目标列表、创建、查看和版本化修改                                |
| GET                | `/ai-coach/readiness`、`/plans/active/status`     | AI 输入缺失项及当前正式版本                                     |
| GET / POST         | `/activities`                                     | 查询 / 记录已发布课程的完成状态、RPE 与疲劳                     |
| GET / POST / PATCH | `/assessments`、`/assessments/:id`                | 测试安排及结果；更新传 `expectedVersion`                        |
| GET / POST / PATCH | `/races`、`/races/:id`                            | 赛事及状态；更新传 `expectedVersion`                            |
| POST               | `/plans/generate-proposal`                        | 首份或空白未来周计划，返回异步任务                              |
| POST               | `/workouts/:id/ai-adjust-proposal`                | 调整一节未来课程                                                |
| POST               | `/plans/adjust-proposal`                          | 调整已有计划中的未来课程                                        |
| POST               | `/assessments/:id/review-proposal`                | 根据测试结果提出未来课程调整                                    |
| POST               | `/races/:id/replan-proposal`                      | 根据赛事变化提出未来课程调整                                    |
| GET                | `/ai-coach/generations/:id`                       | 轮询 `QUEUED / RUNNING / READY / FAILED`；READY 带 `proposalId` |
| GET / PATCH        | `/proposals/:id`、`/ai-coach/proposals/:id`       | 读取提案及修改 AI 草稿                                          |
| POST               | `/proposals/:id/validate`、`/proposals/:id/apply` | 重新校验并确认应用，沿用正式计划事务入口                        |
| GET                | `/plans/versions`、`/plans/versions/:id`          | 历史版本列表与详情                                              |
| POST               | `/plans/versions/:id/restore-proposal`            | 从历史版本创建未来课程恢复提案                                  |
| POST               | `/ai-coach/chat`                                  | 解释当前正式计划，只读                                          |

功体比目标可在 `POST /goals` 传 `targetWkg`。例如 `{"type":"FTP","targetWkg":4,"targetDate":"2027-04-26","priority":"PRIMARY"}`；若档案体重为 55 kg，服务端在生成上下文中换算为目标 FTP 220 W。`GET /ai-coach/readiness` 对缺少体重的此类目标返回 `missingFields:["weightKg"]`。修改体重后，旧 AI 提案需要重新生成。

生成示例：

```http
POST /api/v1/plans/generate-proposal
Authorization: Bearer <access-token>
Idempotency-Key: <uuid>
Content-Type: application/json

{"weekStartDate":"2030-06-03","goalId":"<goal-uuid>","mode":"initial","expectedBaseVersion":0}
```

`202` 返回 `generationId`、`status`、`proposalId`、`errorCode` 和 `requestId`。轮询至 `READY` 后读取 `GET /proposals/:id`，检查课程和变更摘要。若用户修改草稿，`PATCH /ai-coach/proposals/:id` 传 `expectedProposalVersion` 与完整 `draft`，然后调用 `POST /proposals/:id/validate`。最后以 `POST /proposals/:id/apply` 提交 `{"expectedBaseVersion":0}` 并带新的幂等键。

任务与提案响应示例（UUID 仅用于说明）：

```json
{
  "generationId": "d71e1db0-25ec-43aa-a3c7-46f7fb67b5de",
  "status": "READY",
  "proposalId": "3d0396b7-a793-4ee6-899a-54b340b26ad7",
  "errorCode": null,
  "requestId": "b309f8e2-4251-41fb-9b20-6fcb4dc7d862"
}
```

```json
{
  "proposalId": "3d0396b7-a793-4ee6-899a-54b340b26ad7",
  "status": "READY",
  "proposalVersion": 1,
  "basePlanVersion": 0,
  "scene": "WEEK_PLAN",
  "replaceWorkoutIds": [],
  "weekStartDate": "2030-06-03",
  "summary": "本周以耐力训练为主",
  "stageSummary": "基础耐力阶段",
  "assessmentSuggestion": "阶段结束时复评 FTP",
  "workouts": [
    {
      "scheduledDate": "2030-06-04",
      "title": "耐力骑行",
      "purpose": "建立有氧耐力",
      "segments": [
        {
          "type": "work",
          "target": { "kind": "duration", "value": 45, "unit": "min" },
          "intensity": { "kind": "ftp_percent", "min": 65, "max": 75 }
        }
      ]
    }
  ],
  "warnings": [],
  "blockers": [],
  "skillVersion": "1.0.0",
  "model": "<configured-model>"
}
```

缺少资料时，提交接口同步返回 `400`，例如：

```json
{
  "statusCode": 400,
  "code": "INSUFFICIENT_TRAINING_INPUT",
  "message": "请先补全训练资料",
  "missingFields": ["ftp"]
}
```

基础版本过期时返回 `409 PLAN_VERSION_CONFLICT`；模型输出无效时任务变为 `FAILED`，`errorCode` 为 `AI_OUTPUT_INVALID`，不会创建可应用提案。确认成功返回 `success`、`newPlanVersion` 和 `affectedDates`；例如 `{"success":true,"newPlanVersion":1,"affectedDates":["2030-06-04"]}`。

调整请求复用 `weekGenerationInputSchema`，已有计划的 `expectedBaseVersion` 必须等于当前版本；周调整使用 `replace_week`，单课调整使用 `replace_workout`。测试与赛事入口由路径指定关联事件。恢复提案请求传 `expectedBaseVersion`，同样经过预览、校验和确认应用。

常见业务错误：`INSUFFICIENT_TRAINING_INPUT`（含 `missingFields`）、`PLAN_VERSION_CONFLICT`、`NO_EDITABLE_WORKOUTS`、`PROPOSAL_VALIDATION_FAILED`、`IDEMPOTENCY_KEY_CONFLICT`。异步模型或结构校验失败在任务的 `errorCode` 中体现，正式计划不会改变。JWT 或资源归属错误分别按现有鉴权与 404 规则返回。
