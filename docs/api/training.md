# 训练课程 API

所有接口前缀为 `/api/v1`，需要 `Authorization: Bearer <access-token>`。

AI 教练新增的计划生成、调整、历史恢复及相关资料接口见 [AI 教练 API](./ai-coach.md)。这些入口仍复用本页的提案校验和正式版本应用语义。

人工课程在移动端通过一次“保存当天课程”操作自动串联草稿创建/更新、校验和应用接口；成功以应用响应为准。接口与事务边界保持不变，首次/后续版本和幂等检查仍由服务端执行。Web 跨域预检允许 `Authorization`、`Content-Type` 和 `Idempotency-Key`。

## 接口

| 方法  | 路径                                      | 说明                                                 |
| ----- | ----------------------------------------- | ---------------------------------------------------- |
| POST  | `/workouts/manual-proposals`              | 创建手动骑行课程草稿                                 |
| POST  | `/workouts/:workoutId/edit-proposal`      | 创建当天或未来课程编辑草稿                           |
| GET   | `/proposals/:proposalId`                  | 查询提案和校验状态                                   |
| PATCH | `/proposals/:proposalId`                  | 保存草稿动作                                         |
| POST  | `/proposals/:proposalId/validate`         | 服务端校验草稿                                       |
| POST  | `/proposals/:proposalId/apply`            | 幂等应用并创建新正式计划版本                         |
| GET   | `/workouts/next`                          | 当地今天起下一节未记录课程，返回 `{ workout: summary | null }` |
| GET   | `/workouts/:workoutId`                    | 查询课程详情                                         |
| GET   | `/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | 查询当前正式版本课程                                 |

## 关键规则

`GET /calendar` 额外返回 `ftpAvailable`，表示当前用户是否存在可用于手动课程的有效 FTP；课程摘要返回 `planVersion`，客户端编辑已有课程时必须将其作为 `expectedPlanVersion` 提交。

- 没有正式计划时也允许人工创建课程草稿，返回 `basePlanVersion: 0`；草稿创建、读取、修改和校验都不会创建正式计划。确认应用后自动创建 `ACTIVE` 正式计划第 1 版。
- 首次应用传 `expectedBaseVersion: 0`；已有计划时传草稿返回的正整数 `basePlanVersion`。`draftWorkout.planVersion` 首次为 1，正式课程的版本始终为正整数。
- 课程日期必须是用户时区的当天或未来；历史日期编辑返回 `HISTORICAL_WORKOUT_NOT_EDITABLE`。
- 手动课程至少包含一个动作，动作类型为热身、训练、恢复或放松。
- 时间目标单位为分钟，距离目标单位为公里，两者分别汇总。
- 没有 FTP 时不可使用 `%FTP`，但可以使用绝对功率。
- 应用接口必须携带 `Idempotency-Key`，并检查 `expectedBaseVersion`。
- 应用在数据库事务中完成，旧计划版本不可变。
- 同一提案并发重试返回同一版本和日期列表；不同首次草稿同时确认仅一份成功，其他返回 `409 PLAN_VERSION_CONFLICT`，需基于新计划重新创建草稿。
- 未校验返回 `409 PROPOSAL_NOT_READY`；已应用提案禁止编辑/重新校验。READY 草稿修改后恢复 DRAFT，需重新校验。
- 同一个幂等键用于另一份提案返回 `409 IDEMPOTENCY_KEY_CONFLICT`。
- 日历和课程详情只返回当前正式版本，历史副本返回 `404 WORKOUT_NOT_FOUND`；人工来源不影响正式计划资格。

## 课程读取与反馈状态

首页统一使用 [首页聚合接口](./home.md)；`GET /workouts/next` 保留给 AI 范围选择及其他独立课程入口。

`GET /workouts/next` 按账号时区确定今天，仅查询当前用户 ACTIVE 计划的当前正式版本，按 `scheduledDate`、`dayOrder` 升序跳过所有已有反馈的课程（包含部分完成与跳过），返回 `{ workout: <课程摘要> }`；无计划/无待执行课程返回 `{ workout: null }`。没有固定未来日期上限；未登录返回 401。使用对象封装保证空结果仍是合法 JSON。

日历、课程详情和下一课程共享 `workoutSummarySchema`。日历/详情新增 `activity: null | { id, status, durationMin, rpe, fatigue, notes }`；状态为 `COMPLETED | PARTIAL | SKIPPED`，其余实际指标可空。`editable` 同时校验当地日期和实际记录。客户端不从计划目标推断已完成数据。

反馈写入与计划发布共享用户事务锁；只接受当前正式版本、本人所属且日期匹配的课程。已记录返回 `409 ACTIVITY_ALREADY_RECORDED`。人工编辑和最终应用遇到已有反馈返回 `409 WORKOUT_ALREADY_RECORDED`，事务回滚，正式计划保持不变。未改动课程跨版本通过内部稳定引用继续关联原记录。
