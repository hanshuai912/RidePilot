# 训练计划与人工课程数据

`TrainingPlan` 按 `userId` 隔离，`ACTIVE` 加 `activeVersionId` 表示正式计划，与人工/AI 来源无关。`PlanVersion` 的 `(planId, versionNo)` 唯一，版本从 1 开始；`Workout` 与 `PlanItem` 归属具体版本，历史版本保留。

`ChangeProposal.baseVersionId` 可空：`null` 仅用于尚无正式计划时创建人工课程草稿，API 对应 `basePlanVersion = 0`。仅保存或校验草稿不写入正式计划。确认后在同一事务中创建 ACTIVE 计划、第 1 版、课程、日历项目，并记录 `appliedVersionId`、`idempotencyKey`；已有计划继续创建下一版。

应用事务先对当前用户行执行 `SELECT ... FOR UPDATE`，解决首份计划不存在时无法锁定计划行的问题。锁定后重新读取提案和计划，检查基础版本及提案版本，重复请求返回已应用结果。不同首次提案竞争时，后一请求读取到已存在的正式计划并返回版本冲突。任何写入失败都回滚，避免空正式计划或部分课程。所有正式计划发布入口应遵循相同用户锁约定。

日期以 PostgreSQL `DATE` 保存用户时区当地日期，读写边界按用户时区验证；课程时间目标单位为分钟，距离目标为公里，功率单位为 W，FTP 百分比在确认时再次验证。

## 迁移与兼容

- `20261022000000_training_manual_workouts`：创建训练表、枚举、外键和索引。
- `20261022010000_allow_initial_manual_plan`：仅执行 `ALTER TABLE change_proposals ALTER COLUMN base_version_id DROP NOT NULL`。保留基础版本外键与索引，不修改原迁移或已有数据。
- 开发/部署使用 `pnpm --filter @ridepilot/api db:deploy`，并执行 `pnpm db:generate` 更新客户端。
- 应用回退时先停止创建无基础版本草稿，保留新增可空字段兼容已有草稿；若必须恢复 NOT NULL，需先审核并处理所有 `base_version_id IS NULL` 的初始草稿，不能直接强制回退或删除它们。
