# AI 教练数据模型

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
