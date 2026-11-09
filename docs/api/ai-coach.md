# AI 教练 API

## 资料变更影响检查

新增 `GET /plans/input-impact`、`POST /plans/input-impact/decisions`、`GET /plans/input-impact/decisions/:id`、`POST /plans/input-impact/decisions/:id/apply` 与 `POST /plans/input-impact/generate-proposal`。范围使用 `{fingerprint,startDate,endDate}`，决定增加 `action: KEEP|FTP_RECALCULATE`；所有写入需幂等键。本人归属、冲突和原子发布规则见 [功能文档](../features/plan-input-impact.md)。

训练生成输入与 AI 草稿响应新增可选 `planImpact`，贯穿任务恢复、原课程详情、生成时 FTP 与最终依据核对。只支持独立的日期范围重排，不与其他复评证据混用。OpenAPI schema 来源为共享 Zod 契约。

## 持续协作中心

新增共享契约 `packages/contracts/src/coach-center.ts`，均需登录并按本人归属访问：

| 方法 | 路径                                | 说明                                                                                                                                   |
| ---- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| GET  | `/ai-coach/overview`                | 账号时区当天、主目标/阶段、带日期的状态依据、下一未记录课程/已安排测试、最多十四节未来未记录课程、最近五个已应用版本                   |
| GET  | `/ai-coach/suggestions`             | `{pending,recent}`；训练、饮食/补给、阶段草稿及排队/生成任务；recent 包括所有当前失效草稿及最近十条终态记录；含版本和可识别的失效原因  |
| POST | `/ai-coach/suggestions/:id/dismiss` | `{kind:"TRAINING"或"NUTRITION"或"STAGE",expectedVersion:1}`；事务条件更新；同一版本放弃幂等成功；404 不存在/非本人，409 状态或版本变化 |

所有 GET 只读，不提交或应用生成。状态规则、证据时间窗、阶段失效与课程身份规则见 [持续协作中心](../features/ai-coach-center.md)。

`POST /ai-coach/chat` 仍要求正式训练计划，输入 `{message,history?}`，message 1–500字符；history 最多六条 `{role:"user"或"assistant",content}`，每条1–6000字符，不接受 system。服务端读取本人最新概览、未来课程及实际反馈后只读回答，返回 `{answer,requestId,model,readOnly:true}`。会话历史不在服务端持久化，不可调用生成或应用能力。

AI 训练与营养提案 apply 新增可选 `expectedProposalVersion`，与正式基础版本一同检查。教练中心总是发送预览的草稿版本；变化返回409 `PROPOSAL_VERSION_CONFLICT`。旧客户端兼容；已应用提案重复调用保持幂等返回原结果。

问答模型异常返回 `{statusCode,code,message,retryable}`，message 为可直接展示的中文：502 `AI_PROVIDER_OUTPUT_TRUNCATED`（回答额度耗尽，允许重试）、502 `AI_PROVIDER_INVALID_RESPONSE`（缺少有效正文）、504 `AI_PROVIDER_TIMEOUT`、422 `AI_INPUT_REJECTED/AI_OUTPUT_REJECTED/AI_GUARD_REVIEW_REQUIRED`，以及503配置/审核服务错误。失败不新增建议或修改计划，客户端保留问题供手动重试。DeepSeek 问答显式关闭思考模式并使用1600 tokens，返回内容始终是最终正文。

所有路径前缀为 `/api/v1`，需要 `Authorization: Bearer <access-token>`。写入型生成和应用请求应带独立的 `Idempotency-Key`。请求体与响应结构以 `packages/contracts/src/coach.ts` 的 Zod schema 为准。

## FTP 测量时间

`POST /me/ability-measurements/ftp` 接收 `{valueWatts: 整数50–800, source: "MANUAL"|"TEST", measuredAt?: ISO日期时间}`。不传 `measuredAt` 表示当前测量，后端取得用户锁后使用服务器 UTC 时间；骑行功率区间页面使用此方式，避免设备时钟偏差。显式传入日期仍支持时区偏移与历史记录，未来日期返回 400 `FTP_DATE_IN_FUTURE`，不新增测量；null、空字符串或非法日期返回 400。

POST 返回 `{id,valueWatts,source,measuredAt}`，`measuredAt` 始终必填；GET 返回本人最新测量或 null，仍按测量时间、创建时间倒序。已有显式日期请求保持兼容，不需要数据迁移；旧客户端有时钟偏差时需刷新采用新的省略日期请求。接口继续要求 JWT、本人归属与用户行锁，保存不自动修改正式训练或测试。Swagger 从共享 Zod 契约生成。

## 阶段及范围生成（2026-10-30）

所有训练创建/调整均要求可用 FTP，包括手动绝对功率课程；缺失返回 `400 FTP_REQUIRED`，移动端直达骑行功率区间设置。新契约见 `packages/contracts/src/stages.ts`。

| 方法 | 路径                             | 行为                                                                                     |
| ---- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| POST | `/stage-plans/generate-proposal` | `{goalId,startDate,endDate,forceRegenerate?}`，带幂等键，202 返回生成任务；范围 1–365 天 |
| GET  | `/goals/:id/stage-plan`          | `{plan: 阶段安排或 null}`；含 stale 和有序阶段                                           |
| GET  | `/stage-plans/:id`               | 当前用户的阶段草稿/正式/历史安排                                                         |
| POST | `/stage-plans/:id/activate`      | `{expectedVersion}`；事务确认阶段并归档旧安排；同一版本请求可重复提交                    |
| POST | `/plans/generate-range-proposal` | 带幂等键；按阶段或日期生成 1–84 天课程草稿，202 返回任务                                 |

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
| GET / POST / PATCH | `/assessments`、`/assessments/:id`                | 测试安排及结果；需预览、幂等键和版本，见下文阶段测试 API        |
| GET / POST / PATCH | `/races`、`/races/:id`                            | 赛事及状态；更新传 `expectedVersion`                            |
| GET                | `/races/:id/impact-preview`                       | 范围内课程/测试/赛事/阶段影响和当前正式训练版本                 |
| GET / POST         | `/races/:id/result`                               | 读取 / 保存赛后结果                                             |
| POST               | `/plans/generate-proposal`                        | 首份或空白未来周计划，返回异步任务                              |
| POST               | `/workouts/:id/ai-adjust-proposal`                | 调整一节未来课程                                                |
| POST               | `/plans/adjust-proposal`                          | 调整已有计划中的未来课程                                        |
| POST               | `/assessments/:id/review-proposal`                | 根据测试结果提出未来课程调整                                    |
| POST               | `/races/:id/replan-proposal`                      | 手动生成跨周备赛/恢复/取消后回归草稿，支持复用与重新生成        |
| GET                | `/ai-coach/generations/:id`                       | 轮询 `QUEUED / RUNNING / READY / FAILED`；READY 带 `proposalId` |
| GET / PATCH        | `/proposals/:id`、`/ai-coach/proposals/:id`       | 读取提案及修改 AI 草稿                                          |
| POST               | `/proposals/:id/validate`、`/proposals/:id/apply` | 重新校验并确认应用，沿用正式计划事务入口                        |
| GET                | `/plans/versions`、`/plans/versions/:id`          | 历史版本列表与详情                                              |
| POST               | `/plans/versions/:id/restore-proposal`            | 从历史版本创建未来课程恢复提案                                  |
| POST               | `/ai-coach/chat`                                  | 解释当前正式计划，只读                                          |

功体比目标可在 `POST /goals` 传 `targetWkg`。例如 `{"type":"FTP","targetWkg":4,"targetDate":"2027-04-26","priority":"PRIMARY"}`；若档案体重为 55 kg，服务端在生成上下文中换算为目标 FTP 220 W。`GET /ai-coach/readiness` 对缺少体重的此类目标返回 `missingFields:["weightKg"]`。修改体重后，旧 AI 提案需要重新生成。

赛事训练接口接收 `weekGenerationInputSchema`，服务端固定 `scene=RACE_REPLAN` 和 URL 对应的赛事 ID。`mode=range` 使用 `weekStartDate/endDate`（今天或未来开始，1–84 天），支持跨周；旧 `replace_week` 周请求兼容。`racePhase` 为 PREPARATION（备赛）、RECOVERY（恢复）或 RETURN_TO_GOAL（取消后回归），不传时按赛事状态/日期确定。`relatedVersion` 校验赛事或结果版本。无正式计划时支持 `expectedBaseVersion=0`；已有计划保留历史、已记录及范围外课程。普通请求复用已有方案/任务；`forceRegenerate=true` 明确请求新候选，仍复用正在运行的同场景任务。提交在用户锁事务中幂等创建，不自动应用。

`GET /races/:id/training-proposal?phase=...` 返回 `{phase,today,startDate,endDate,generation,proposal,message}`。优先恢复当前正式版本对应的已应用方案；明确重新生成的可用草稿/任务优先展示。赛事/计划版本改变或草稿过期后不复用，并提示重新生成。缺少 FTP 返回 FTP_REQUIRED；其他资料缺失返回 INSUFFICIENT_TRAINING_INPUT 与 missingFields，补填返回后仍需用户点击。

`GET /races/:id/impact-preview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` 支持所选范围，返回日期、课程与 retained 标记、测试/赛事冲突、相关阶段及 messages。无查询时使用当前场景默认范围。测试与正式阶段只展示影响，不在课程应用中自动移动或修改。

修改/取消赛事、更新结果时停止关联 QUEUED/RUNNING 任务，并将尚未应用的训练/营养提案置为 EXPIRED；已应用版本保留。结果实际日期不能在未来，更新已有结果必须携带匹配的 expectedVersion。所有读取和写入校验归属，旧草稿无法通过应用检查。

`INSUFFICIENT_RECOVERY` 表示候选草稿包含相邻自然日的高强度 work 区段（上限达到 90% FTP）。生成请求明确提供这条约束；首次违反时在同一任务内带错误反馈纠正一次，仍不通过则任务失败，客户端显示中文提示并等待用户主动重新生成。严格领域校验不因赛事场景放宽。

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
  "skillVersion": "1.3.0",
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

阶段测试安排、结果及 FTP 独立确认已升级，字段、预览、幂等和迁移见 [阶段测试 API](assessments.md)。范围生成可携带 assessmentId / assessmentVersion，课程应用前重查证据版本。

## 生成复用与失效建议（2026-11-05）

普通周、调整、范围及阶段生成按账号、场景、完整输入复用运行任务或当前有效草稿，支持可选 `forceRegenerate:true` 显式重新生成。范围请求的两个 scope 均支持该参数。重复点击同一运行请求（包括 force）继续查询原任务。新候选成功后才在事务中替代同任务范围的旧候选；失败保留旧候选。已有幂等键的不同请求仍409。

GET 建议列表把版本/资料失效的候选投影为 EXPIRED，从 pending 移到 recent；被成功新候选替代的记录显示 SUPERSEDED。历史只读，不修改原数据。阶段详情的状态增加 SUPERSEDED。生成中上下文变化返回任务 FAILED/errorCode=GENERATION_CONTEXT_CHANGED；到期草稿应用返回409 PROPOSAL_EXPIRED。详见 [建议生命周期](../features/coach-suggestion-lifecycle.md)。

## 周期复盘（2026-11-05）

新增 GET `/ai-coach/cycle-review`（可选 startDate/endDate）、GET `/ai-coach/cycle-review/history`（最近30次主动生成）、POST `/ai-coach/cycle-review/generate-proposal`（202，要求 Idempotency-Key）。所有接口 JWT 鉴权、本人数据隔离。共享协议在 `cycle-review.ts`。生成输入的 review 为日期/action/fingerprint 引用，服务端重算证据；后续日期和基础版本单独传入。训练草稿响应增加可选 cycleReview 证据。读取不调用模型、不写草稿。依据变化409 CYCLE_REVIEW_STALE；恢复区段超过70% FTP则任务失败或校验阻止应用。完整输入、统计口径和异常处理见 [周期复盘](../features/training-cycle-review.md)。

## 目标生命周期与阶段复评

新增目标评价、概览、变更预览/确认，以及阶段条件、复评读取/保存接口，详见 [功能契约](../features/goal-lifecycle-stage-review.md#api)。新增请求/响应 schema 是 `goal-lifecycle.ts`、`stage-review.ts`，Swagger 引用同一 schema。

目标变更必须提交 expectedVersion、原因与预览 fingerprint；确认接口要求用户唯一幂等键。阶段复评提交当前 snapshot fingerprint 和 expectedReviewId（首次为 null），避免新决定被旧页面覆盖；同键不同内容返回 409。阶段条件用独立 criteriaVersion 保护。

阶段/范围生成新增可选 stageReviewId，阶段及课程预览返回保存时 evidence。后续请求只能沿用该阶段最新且依据未变化的决定。保持/进入下一阶段限制课程 stageId，延长先确认阶段草稿，调整允许日期课程或阶段重规划。所有正式应用仍需校验和用户确认，目标操作不隐式发布训练或营养。

## 候选局部编辑与明细快照（2026-11-09）

移动端现在调用已有 `PATCH /ai-coach/proposals/:id`，以 `expectedProposalVersion` 更新完整结构化候选中的单节课程，其他课程保留；成功后草稿版本递增、状态为 DRAFT，清除旧校验。必须重新预览校验和确认应用。已应用/失效/其他用户的草稿不可编辑。所有移动端 AI 应用入口传预览时的草稿版本，避免应用未审阅内容。

新草稿 `replacedWorkouts[]` 增加可选 `purpose`、`segments` 原安排快照，用于原/新目标、强度、重复次数比较；字段缺失表示旧数据不具备明细。多课程按完整旧/新安排展示，不仅凭日期强行配对。
