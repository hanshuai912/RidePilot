# AI 教练 API

所有路径前缀为 `/api/v1`，需要 `Authorization: Bearer <access-token>`。写入型生成和应用请求应带独立的 `Idempotency-Key`。请求体与响应结构以 `packages/contracts/src/coach.ts` 的 Zod schema 为准。

## 阶段及范围生成（2026-10-30）

所有训练创建/调整均要求可用 FTP，包括手动绝对功率课程；缺失返回 `400 FTP_REQUIRED`，移动端直达骑行功率区间设置。新契约见 `packages/contracts/src/stages.ts`。

| 方法 | 路径                             | 行为                                                                    |
| ---- | -------------------------------- | ----------------------------------------------------------------------- |
| POST | `/stage-plans/generate-proposal` | `{goalId,startDate,endDate}`，带幂等键，202 返回生成任务；范围 1–365 天 |
| GET  | `/goals/:id/stage-plan`          | `{plan: 阶段安排或 null}`；含 stale 和有序阶段                          |
| GET  | `/stage-plans/:id`               | 当前用户的阶段草稿/正式/历史安排                                        |
| POST | `/stage-plans/:id/activate`      | `{expectedVersion}`；事务确认阶段并归档旧安排；同一版本请求可重复提交   |
| POST | `/plans/generate-range-proposal` | 带幂等键；按阶段或日期生成 1–84 天课程草稿，202 返回任务                |

范围请求二选一：

```json
{
  "scope": "DATES",
  "goalId": "<uuid>",
  "startDate": "2030-01-08",
  "endDate": "2030-01-21",
  "expectedBaseVersion": 3,
  "notes": "可选补充"
}
```

```json
{
  "scope": "STAGE",
  "goalId": "<uuid>",
  "stageId": "<uuid>",
  "expectedBaseVersion": 3
}
```

日期不要求周一。阶段 ID 必须属于当前用户、当前目标及有效阶段安排，日期由后端读取。旧周生成接口保持原有周一规则，不接受范围模式。范围响应 `scene=RANGE_PLAN`，新增 `endDate`、可选 `stageId` 和 `replacedWorkouts:[{id,scheduledDate,title}]`；预览、校验、应用复用 `/proposals`。`affectedDates` 包含移除课程日期。

`STAGE_PLAN` 的生成任务 READY 后，`proposalId` 指向 `/stage-plans/:id`；课程任务指向 `/proposals/:id`。调用方按自己提交的任务类型读取，不混用。阶段确认不会创建课程或测试。

版本冲突返回 409；过期阶段返回 `STAGE_PLAN_STALE`；不合法范围返回 `INVALID_DATE_RANGE`。每个目标最多一个 ACTIVE 阶段安排。阶段、课程生成失败不改正式安排；课程确认继续进行服务端重验与正式版本检查。

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
  "skillVersion": "1.2.0",
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

调整请求复用 `weekGenerationInputSchema`，已有计划的 `expectedBaseVersion` 必须等于当前版本；周调整使用 `replace_week`，单课调整使用 `replace_workout`。训练日历的每节课程会返回可选的 `editable` 字段：只有课程日期不早于用户时区当天且没有训练记录时为 `true`。测试与赛事入口由路径指定关联事件。恢复提案请求传 `expectedBaseVersion`，同样经过预览、校验和确认应用。

`empty_week` 用于为本周剩余可训练日期补排课程。服务端只把仍可编辑的未来课程视为“该周已有课程”；历史课程或已经记录训练的课程会保留在新版本中，不会阻止剩余日期生成。若仍有可编辑课程，返回 `409 WEEK_NOT_EMPTY` 并要求使用调整入口；若没有剩余可训练日期，返回 `409 NO_REMAINING_TRAINING_DATES`。

常见业务错误：`INSUFFICIENT_TRAINING_INPUT`（含 `missingFields`）、`PLAN_VERSION_CONFLICT`、`NO_EDITABLE_WORKOUTS`、`PROPOSAL_VALIDATION_FAILED`、`IDEMPOTENCY_KEY_CONFLICT`。异步模型或结构校验失败在任务的 `errorCode` 中体现，正式计划不会改变。JWT 或资源归属错误分别按现有鉴权与 404 规则返回。

## 移动端快捷调整与反馈

课程详情的“让 AI 调整这节课”使用 `POST /workouts/:id/ai-adjust-proposal`，默认请求体为 `mode=replace_workout`，并传入课程的 `planVersion`、目标、周一日期、快捷原因和可选说明。客户端读取异步任务关联的提案后，显示原课程和新课程差异；只有提案重新校验为 `READY`，并经用户确认，才调用 `/proposals/:id/apply`。

课程详情的“记录训练反馈”使用 `POST /activities`，保存完成状态、实际时长、RPE、疲劳和备注。训练记录与正式计划版本独立保存，已记录课程不再作为可调整课程覆盖。响应结构包含 `id`、`workoutId`、`localDate`、`status`、`durationMin`、`rpe`、`fatigue` 和 `notes`。
