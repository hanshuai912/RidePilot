# 多目标综合训练规划

2026-11-13：课程生成将综合阶段一起预览和原子应用；有效阶段沿用或补齐，无有效阶段时配套建立。独立阶段入口仍可单独规划。详见 [自动配套阶段](course-stage-generation.md)。

2026-11-10 用户确认：阶段、阶段测试与训练课程应综合全部目标统一规划，避免分别按目标生成后相互替换。关联 PRD FR-106、FR-204、FR-308。

## 行为与交互

- 目标仍独立新增、编辑、暂停和完成。全部 `ACTIVE` 目标组成同一规划输入，`PRIMARY` 决定主要训练重点，`SECONDARY` 在可训练时间、赛事、测试和恢复约束内兼顾；暂停及关闭目标不进入新规划。没有唯一进行中的主目标时阻止生成，提示先在目标管理中确定主目标。
- 每个用户仅有一份新的综合正式阶段安排。阶段确认独立于课程和测试，预览、确认后归档该用户旧的所有活跃阶段安排。未确认、生成失败或冲突时，旧安排和课程保持原状。
- 目标与阶段页保留目标切换卡片和独立编辑入口。切换只改变目标概览，不切换共享阶段、测试或课程表单，不触发生成，不清空日期、阶段选择或备注。离开规划页面时仍保留未保存保护；进入编辑等子页再返回保留输入。
- 目标概览下直接展示「阶段安排」和「规划后续训练」，移除「综合训练规划」标题层。共享规则合并到「阶段安排」旁叹号，已有阶段摘要也在同一弹窗内按需查看；没有阶段时仍可查看共享规则，避免常驻长说明。阶段和课程预览展示参与的主次目标、日期及模型给出的 `goalTradeoffs`；多目标输出必须包含该数组，没有取舍时为空。取舍是 AI 候选说明，用户确认后才应用，不视为已保证实现目标或科学可行性证明。
- 测试列表在所有目标入口读取同一份用户测试日程。测试仍需单独安排并确认同日冲突，不会为每个目标自动重复创建。历史 `goalId` 保留来源，`stageId` 关联综合阶段。同方法、来源、条件和时长等一致时可跨来源目标比较历史测量，不能据一次测试自动确认所有目标达成。
- 目标没有达成截止日期。阶段按用户选择范围规划，最长 365 天及每阶段 84 天；范围课程最多 84 天。模型根据当前能力、训练反馈和阶段复评循序推进；赛事专项保留其既有日期范围规则。

## 数据与 API

- 迁移 `20261110120000_unified_goal_planning` 仅增加 `training_stage_plans.goals_snapshot JSONB NULL` 和针对非空快照、`ACTIVE` 状态的用户唯一部分索引。无删除、无回填，不自动合并旧阶段。
- `goals_snapshot` 保存 `{goals, tradeoffs}`，包含全部活跃目标的 ID、版本、主次和内容。`goalId/goalVersion` 保留为生成时主目标锚点，兼容历史外键；不再表示只服务该目标。课程草稿在既有 JSON 中保存同样的 `goalsSnapshot`，无课程表迁移。
- `GET /goals/:id/stage-plan` 先验证所选目标归属，再返回用户共享的正式阶段。返回增加 `scope: ALL_GOALS | LEGACY_GOAL`、`planningGoals` 和 `goalTradeoffs`。旧计划快照为空，标记 `LEGACY_GOAL` 和 `stale=true`，可读但不能继续按该阶段生成课程或新增阶段测试；独立测试和已有测试历史保留。
- 生成接口继续接受 `goalId`，验证其归属和活跃状态，再以当前主目标及完整目标清单作为生成依据。移动端统一传主目标 ID。课程响应增加 `planningGoals` / `goalTradeoffs`；所有训练生成场景共用完整目标上下文。
- 测试列表页面不再传 `goalId` 筛选；该可选 API 参数保留为历史来源筛选。测试生成与后续课程不再要求测量来源目标与当前主目标相同，但始终校验测试归属、结果状态及版本。

## 一致性与错误

- 生成完成、阶段确认、课程校验和应用、阶段复评与复用草稿时核对全目标快照。新增/删除目标、暂停/恢复、修改任一目标或切换主目标后，旧候选不能继续确认。历史正式课程和测试不因目标变化自动改写；重新规划仍需预览确认。
- 旧课程草稿缺少完整目标快照时阻止应用并要求重新生成，避免误用单目标候选。已应用记录仍可读取，幂等重试返回原结果。
- 用户行锁、正式计划版本、草稿版本与幂等规则继续有效。新综合阶段确认在同一事务内归档旧安排并启用新安排，唯一部分索引防止两个综合安排同时活跃。
- 赛事与测试禁排日期、每日总可用时长、单次时长及既有强度上限在生成和应用时重验。恢复校验增加保留课程，以及所选日期范围前后一天的高强度日，禁止新课程与这些课程同日或连续安排高强度；不会跨范围静默移动原课程。
- 服务端错误沿用 `STAGE_PLAN_STALE`、`PLAN_VERSION_CONFLICT`、`PROPOSAL_VALIDATION_FAILED` 等。缺少唯一主目标返回 `PRIMARY_GOAL_REQUIRED`；多目标模型输出缺少取舍数组返回 `GOAL_TRADEOFFS_REQUIRED`。读取其他目标失败时保留当前内容，隐藏生成表单并提供重试。

## 实现边界

`goals/planning-goals.ts` 集中处理目标快照、主目标和生成指令；`retained-training.ts` 提取保留课程恢复约束。阶段服务继续使用原生成/确认事务，课程继续使用原发布事务，避免新增第二条写入路径。移动端使用现有黑金 Token、日期选择器、卡片、叹号和独立预览页。

这次统一规划范围为全部进行中骑行目标。目标兼容性与训练取舍由模型提出，程序验证结构、版本、日期、时长及既有恢复边界，不声称实现通用运动生理优化器。真实模型输出质量、iOS/Android 真机及系统大字体需要后续验证。

## 验证记录

测试包括 `unified-goal-planning.e2e-spec.ts` 的共享阶段和课程目标清单、跨来源测试、次目标变更、主目标切换、新增目标后过期、历史阶段只读及显式确认归档；恢复边界单测；移动端共享阶段、目标概览切换保留输入、从次目标进入仍统一生成、读取失败重试等。

实际执行：

| 命令                                                                                                                                  | 结果                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @ridepilot/mobile test`                                                                                                | 40 组、377 项全部通过                                                                                                                                                     |
| `pnpm --filter @ridepilot/mobile typecheck`、`pnpm --filter @ridepilot/mobile lint`                                                   | 通过                                                                                                                                                                      |
| `node_modules/.bin/tsc -p packages/contracts/tsconfig.json`                                                                           | 通过                                                                                                                                                                      |
| `apps/api/node_modules/.bin/tsc -p apps/api/tsconfig.build.json`、`apps/api/node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit` | 通过                                                                                                                                                                      |
| `node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`                                                          | 通过                                                                                                                                                                      |
| `apps/api/node_modules/.bin/prisma generate --schema apps/api/prisma/schema.prisma`、`prisma validate`                                | 通过                                                                                                                                                                      |
| `node /tmp/ridepilot-unified-tests.cjs --deploy`                                                                                      | 在隔离的本机 `_test` PostgreSQL 成功应用迁移                                                                                                                              |
| `node /tmp/ridepilot-unified-tests.cjs`                                                                                               | 完整 API 回归 45 组、305 项通过；真实模型 1 组、1 项按既有配置跳过                                                                                                        |
| `node /tmp/ridepilot-unified-tests.cjs test/unified-goal-planning.e2e-spec.ts`                                                        | 综合规划 4 项通过，包含次目标来源测试用于主目标锚点的综合课程                                                                                                             |
| `pnpm --filter @ridepilot/mobile exec expo export --platform web --output-dir /tmp/ridepilot-unified-goals-web --max-workers 2`       | 最终 Web 导出通过                                                                                                                                                         |
| `node /tmp/ridepilot-unified-goals-browser.cjs`                                                                                       | Chrome 320/390/430 宽度通过：共享阶段与测试、切换保留输入且不请求、编辑所选目标、叹号说明、主次目标及取舍预览、显式校验、旧阶段禁用和列表失败重试；无横向溢出或运行时错误 |

API runner 读取 `.env.test` 并强制 localhost `_test` 数据库与 Redis DB 1，集成模型使用替身。浏览器使用拦截 API 的合成数据，只提交了显式点击的校验请求，没有真实用户写入。测试有 pg 并行查询的既有弃用警告。pnpm 因沙箱元数据库限制在沙箱外运行，未更改依赖。

## 本机开发库迁移

按用户授权执行 `node /tmp/ridepilot-migrate-unified-dev.cjs`，脚本只允许本机 `ridepilot` 开发库，拒绝任何额外待迁移项，再调用项目 Prisma `migrate deploy` / `migrate status`。成功应用本次唯一待迁移 `20261110120000_unified_goal_planning`，状态为最新；检查新增字段为可空 JSONB、唯一部分索引存在。

迁移前后只读计数一致：目标 4、阶段安排 2、阶段 6、测试 1、训练计划 2、课程 264。没有回填、归档、修改目标、生成课程或创建测试。运行中 `/api/v1/health` 返回 200，数据库与 Redis 均正常。旧单目标安排保留并标记过期，需用户重新规划、预览并确认综合阶段后才替换；正式环境未部署。
