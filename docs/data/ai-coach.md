# AI 教练数据模型

2026-11-10：迁移 `20261110120000_unified_goal_planning` 为 `TrainingStagePlan` 新增可空 `goalsSnapshot`（JSONB，映射 `goals_snapshot`），保存 `{goals, tradeoffs}`。旧数据为空，不回填为综合计划；新阶段以主目标为 `goalId/goalVersion` 锚点，但服务全部活跃目标。部分唯一索引 `training_stage_plans_one_unified_active_per_user` 限制每个用户只能有一份快照非空且 ACTIVE 的综合安排；确认新草稿在同一事务中归档全部旧 ACTIVE 安排。无数据删除。回退应用时保留新增列和索引及历史快照，不执行破坏性回滚。课程快照存于既有草稿 JSON，无课程表结构变更。详见 [多目标综合规划](../features/unified-goal-planning.md)。

迁移 `20261026000000_coach_foundation` 增加目标、可训练时间、训练记录、阶段测试、赛事和异步生成任务表，并扩充 `ChangeProposal.proposalType`。迁移 `20261026010000_coach_event_versions` 为测试和赛事加入乐观锁版本。迁移 `20261026020000_goal_target_wkg` 为目标添加可空 `target_wkg`，保留旧目标兼容性。新表关联 `users.id`，所有读取与写入均通过当前登录用户过滤。

| 模型                   | 用途与约束                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `TrainingGoal`         | 目标、可选目标功体比、目标日期、优先级、状态和版本号；生成时记录目标版本快照                |
| `TrainingAvailability` | 用户时区、每周可训练日与分钟、单次上限、版本号；一个用户一条                                |
| `TrainingActivity`     | 关联已发布课程，记录完成状态、时长、RPE、疲劳；`(userId, workoutId)` 唯一                   |
| `TrainingAssessment`   | 阶段测试安排、结果、条件、状态和版本号                                                      |
| `TrainingRace`         | 赛事日期、距离、优先级、状态和版本号                                                        |
| `AiGeneration`         | 异步任务、请求快照、幂等键、状态、重试次数、租约和关联提案；`(userId, idempotencyKey)` 唯一 |
| `ChangeProposal`       | AI 生成输出、Skill 版本与哈希、输入版本快照、验证状态；应用后指向新计划版本                 |

FTP 使用现有 `AbilityMeasurement` 的 `metricType=FTP`、`unit=W`。课程仍使用现有不可变 `PlanVersion → Workout / PlanItem` 结构，AI 创建的课程 `source=ai`；人工课程 `source=manual`。训练日期存 PostgreSQL `DATE`，按用户时区解释。功率单位 W，训练时长单位分钟，距离单位公里。

功体比目标单位 W/kg，目标 FTP 的 W 数值按目标 W/kg × 当前档案体重 kg 由 TypeScript 计算，并随目标和档案版本一起核对。体重缺失时不生成这种目标的训练草稿；体重变化后旧提案不能应用。不会根据一周计划自动修改已测 FTP。

发布事务锁定用户行，校验基础版本及草稿状态，复制保留课程并写入新版本，再切换 `TrainingPlan.activeVersionId`。历史版本始终保留；恢复也是创建新版本。迁移先在独立测试库执行，不会删除现有训练数据。生产迁移前应备份数据库并按现有部署流程应用。

# 阶段安排数据扩展（2026-10-30）

迁移 `20261030160000_training_stages` 新增 `training_stage_plans` 与 `training_stages`。阶段计划关联用户和训练目标，保存目标版本、FTP 测量 ID、时间安排版本、档案版本、基准阶段计划 ID、唯一生成任务 ID、起止日期及模型/Skill 版本。阶段有独立 UUID、顺序、名称、目的、起止日期和复评建议。

状态为 DRAFT → ACTIVE → ARCHIVED。确认阶段按用户行加锁并检查快照，事务内归档旧安排、激活新安排、递增版本。部分唯一索引 `training_stage_plans_active_goal` 保证同一目标最多一份 ACTIVE；`stage_plan_id + position` 唯一。删除用户/目标时阶段级联删除。基准阶段 ID、FTP 测量 ID 和生成任务 ID 用于不可变来源快照，不随能力更新改写。

复用 AiGeneration 的 `scene=STAGE_PLAN` 和现有 Worker，不增加队列依赖。阶段生成成功先持久化 DRAFT，AiGeneration.proposalId 在此场景指向阶段计划 UUID；其他课程场景继续指向 ChangeProposal。阶段选择生成课程时在草稿中记录不可变 stageId 和解析日期，校验/应用重查当前有效阶段与目标版本。

迁移仅新增表，不改写既有课程。验证先在隔离 `_test` 库执行 `prisma migrate deploy`，再执行集成测试。部署前运行 `pnpm --filter @ridepilot/api db:generate` 和 `db:deploy`。回退应用版本可保留新增表；需要物理回滚时须先备份阶段数据并确认没有引用，再单独制定删除表迁移，本任务不执行删除。

阶段测试新增类型、实际日期、来源/RPE、阶段关联及幂等日志，见 [阶段测试数据](assessments.md)。旧版测试保留为 LEGACY，不可自动用来更新 FTP。

## 赛事范围与草稿失效（2026-11-04）

无需新增列或迁移。赛事训练的 AiGeneration.input 增加可选 racePhase、forceRegenerate、endDate 和 relatedVersion；ChangeProposal.draft 保留对应日期范围、场景及赛事版本快照。旧周请求和提案继续读取。恢复查询只返回当前赛事和正式版本匹配的方案，明确重新生成的候选优先于旧已应用方案。

赛事改期、取消或更新结果在同一用户行锁事务中递增赛事版本、停止关联排队/运行任务（FAILED / RACE_VERSION_CONFLICT）、将未应用训练及营养提案置为 EXPIRED。通过 AiGeneration.input 的 relatedId/raceId 关联既有提案。正式训练/营养版本及实际训练记录不修改；用户确认新草稿时才创建新的正式版本。

## 2026-11-05：候选替代与只读失效投影

无 Prisma schema 或 migration 变化。复用 AiGeneration.input/proposalId 识别同一任务；训练 draft 增加内部 contextFingerprint。成功替代时，同范围旧 ChangeProposal/NutritionProposal 设 EXPIRED、validationPassed=false、proposalVersion+1、validationBlockers 保存替代原因。TrainingStagePlan.status 为 String，新增 SUPERSEDED、version+1，不改已确认的 ACTIVE。列表展示 SUPERSEDED，时间或版本失效只读投影 EXPIRED，不删除记录、不回填旧资料快照。并发提交和成功替代都在用户行锁事务内完成。详见 [生命周期规则](../features/coach-suggestion-lifecycle.md)。

## 周期复盘证据（2026-11-05）

无新增表或 migration。AiGeneration.input.cycleReview 保存复盘日期、动作和 fingerprint，成功后的 ChangeProposal.draft.cycleReview 保存完整生成依据。草稿编辑只允许课程输出字段，不接受替换证据；应用前重新计算证据指纹，appliedVersionId 追溯应用版本。失败任务仅保存复盘引用，不保证完整快照。计划复制按稳定活动身份去重；聚合只使用已填数值，未记录不视为失败。详见 [周期复盘](../features/training-cycle-review.md)。

## 目标决策与阶段复评数据

迁移 `20261106090000_goal_lifecycle_stage_reviews`：

- TrainingGoal 新增 successCriteria、targetFtpWatts（W）、closureReason（COMPLETED / STOPPED，旧数据 null）。
- TrainingStage 新增 criteria、criteriaVersion（默认 1），不以日期自动回填达成状态。
- TrainingStagePlan 新增 reviewEvidence JSON，记录生成来源；正式阶段保留来源快照作为历史。
- GoalMutation 保存目标操作、理由、requestHash、result（包含 before/after/影响预览）和用户幂等键。
- TrainingStageReview 保存阶段结论、下一步选择、理由与不可变 snapshot。用户锁下按实际保存顺序分配递增 createdAt，最新决定才能用于后续生成。
- 两类记录均关联用户，按用户幂等键唯一；阶段复评有阶段/时间索引，FK 随账户删除级联。

目标变更、主次切换及决策写入同一事务。阶段复评不写 FTP、正式训练或阶段日期；正式课程应用沿用现有版本事务。迁移为增量、无数据回填；自动化测试使用本机 *_test 数据库，后续按用户授权已应用到本机开发库 `ridepilot`，迁移状态及业务只读查询验证通过，正式环境尚未部署；回滚应用时保留新增数据表列，避免删除用户历史。详见 [功能与边界](../features/goal-lifecycle-stage-review.md)。

## 生成任务取消（2026-11-10）

`AiGeneration.status` 增加应用层终态 `CANCELLED`，现有 varchar(16) 可直接保存，无 schema 或迁移变化。QUEUED/RUNNING 可取消；取消清空 leaseUntil/errorCode，保留输入、幂等键、尝试次数和追踪 ID。重复取消不变；原提交键返回已取消结果，新键才创建新任务。

取消与训练/阶段/营养草稿完成均锁定所属用户行，Worker 按 RUNNING 与 attempts 条件写入。先取消则迟到结果丢弃，先完成则取消返回冲突，避免取消后复活或生成候选。CANCELLED 进入历史记录，去重和待处理查询排除该状态。详见 [取消生成功能](../features/ai-generation-cancellation.md)。

## 聊天历史（2026-11-12）

新增 CoachChatTurn（coach_chat_turns），保存所属用户、客户端消息标识、问题、回答、状态、版本、尝试编号、租约及时间戳。唯一键为 (user_id, client_message_id)，分页索引为 (user_id, created_at, id)，User 删除时级联清理。迁移 20261112090000_coach_chat_history 仅新增表、枚举及索引。用户行锁、attemptId 和 expectedVersion 分别保证同账号发送串行、旧尝试隔离和失败重试版本校验；模型调用在事务外。详情与兼容策略见 [聊天布局与历史记录](../features/coach-chat-history.md)。
