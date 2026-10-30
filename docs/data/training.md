# 训练计划与人工课程数据

AI 教练的新增模型、迁移和 AI 课程来源见 [AI 教练数据模型](./ai-coach.md)。

`TrainingPlan` 按 `userId` 隔离，`ACTIVE` 加 `activeVersionId` 表示正式计划，与人工/AI 来源无关。`PlanVersion` 的 `(planId, versionNo)` 唯一，版本从 1 开始；`Workout` 与 `PlanItem` 归属具体版本，历史版本保留。

`ChangeProposal.baseVersionId` 可空：`null` 仅用于尚无正式计划时创建人工课程草稿，API 对应 `basePlanVersion = 0`。仅保存或校验草稿不写入正式计划。确认后在同一事务中创建 ACTIVE 计划、第 1 版、课程、日历项目，并记录 `appliedVersionId`、`idempotencyKey`；已有计划继续创建下一版。

应用事务先对当前用户行执行 `SELECT ... FOR UPDATE`，解决首份计划不存在时无法锁定计划行的问题。锁定后重新读取提案和计划，检查基础版本及提案版本，重复请求返回已应用结果。不同首次提案竞争时，后一请求读取到已存在的正式计划并返回版本冲突。任何写入失败都回滚，避免空正式计划或部分课程。所有正式计划发布入口应遵循相同用户锁约定。

日期以 PostgreSQL `DATE` 保存用户时区当地日期，读写边界按用户时区验证；课程时间目标单位为分钟，距离目标为公里，功率单位为 W，FTP 百分比在确认时再次验证。

## 迁移与兼容

- `20261022000000_training_manual_workouts`：创建训练表、枚举、外键和索引。
- `20261022010000_allow_initial_manual_plan`：仅执行 `ALTER TABLE change_proposals ALTER COLUMN base_version_id DROP NOT NULL`。保留基础版本外键与索引，不修改原迁移或已有数据。
- 开发/部署使用 `pnpm --filter @ridepilot/api db:deploy`，并执行 `pnpm db:generate` 更新客户端。
- 应用回退时先停止创建无基础版本草稿，保留新增可空字段兼容已有草稿；若必须恢复 NOT NULL，需先审核并处理所有 `base_version_id IS NULL` 的初始草稿，不能直接强制回退或删除它们。

## 不变版本与实际记录关联

未改动课程复制到新正式版本时，在内部 `Workout.structure` JSON 中保存 `activityWorkoutId`，指向该逻辑课程首次保留的 Workout ID；若原对象已有该字段则继续传递，不能重置为中间副本 ID。人工、AI 和版本恢复的未改动课程复制均遵循此规则。实际记录仍保存在原 `TrainingActivity`，不复制或移动记录；日历和详情将其映射到当前副本。新建、实际替换或修改的课程使用新身份。

`activityWorkoutId` 不属于客户端草稿契约，客户端不能指定关联目标。读取和写入始终校验 `userId`。反馈写入和所有正式计划发布使用同一用户行锁，避免课程被替换后向旧副本写入或反馈已提交后仍覆盖。

本次没有新增表或 SQL 迁移。上线前已复制且缺少该字段的历史副本无法可靠自动推断原记录关联，本次不进行猜测式回填；已有原始记录保持完整。新增字段随后续保留复制逐步建立关联。

首页聚合读取不新增表。训练区使用 Repeatable Read 只读事务，同时读取正式计划快照、当地今天起课程、实际记录和 FTP 可用性；计划状态、当天课程与下一节引用同一版本。饮食为独立版本，按相同当地日期聚合，故不会声称训练和营养版本原子发布。
