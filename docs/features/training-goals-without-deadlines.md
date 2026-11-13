# 训练目标按实际进展持续推进

## 目的与范围

按 2026-11-13 用户确认，取消普通训练目标的达成日期。这项需求覆盖 FTP、耐力、爬坡、自定义及备赛方向目标；实际赛事由赛事模块独立管理。此规则覆盖 PRD M02 原先要求目标日期的约定。

目标描述训练方向和可选能力指标。阶段复评结合实际训练、疲劳反馈、能力测量及达成证据，由用户决定保持、延长阶段、调整安排或进入下一阶段。系统不推算或承诺达成日期。

保留实际赛事日期、课程排期、阶段起止日期及能力测量日期。阶段结束表示本次排期结束，不代表目标达成。

## 用户流程与界面

- 首次建档和新增／编辑目标不再填写达成日期；目标列表、详情、评估、变更预览和教练调整页移除日期、倒计时及延期入口。
- 能力差距、每周可训练时间及测量依据仍展示。完成目标仍要求达成条件和实际证据，并经过预览确认。
- 课程默认从用户当地今天规划未来 4 周；阶段优先使用有效的已有安排结束日，否则默认未来 12 周。复评后的自选日期默认未来 4 周。用户可修改这些排期范围，它们不是达成期限。
- 课程每次最多 84 天；阶段整体最多 365 天，每阶段最多 84 天，最多 12 阶段。过去日期、不可训练日、赛事／测试冲突和恢复约束继续校验。
- 加载、失败重试、取消和草稿预览保持原流程。目标创建不再因读取时区失败而阻塞。

## 技术与 API

共享契约位于 `packages/contracts/src/coach.ts`、`goal-lifecycle.ts`、`stage-review.ts`、`cycle-review.ts`、`coach-center.ts` 和 `plan-impact.ts`。

| 接口                                          | 变化                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/v1/goals`、`POST /goals/evaluate`  | 不要求 `targetDate`；合法旧字段可提交但被忽略                        |
| `PATCH /api/v1/goals/:id`、目标变更预览／确认 | `UPDATE`、`RESUME`、`CREATE_NEXT` 无达成日期校验；旧字段不改变历史列 |
| 目标及预览响应                                | 不返回 `targetDate`，评价不返回 `daysRemaining`                      |
| 阶段复评响应                                  | 不返回 `goalTargetDate`，后续规划不受旧日期限制                      |
| 周期复盘、教练概览、计划资料影响响应          | 移除嵌套目标日期／`goalTargetDate`                                   |
| 课程与阶段生成                                | 仅按所选范围及既有业务约束校验，不再计算目标最晚期限                 |

AI 输入的 `goal`、`planningGoals` 和复评快照不携带达成期限，训练适配规则更新到 1.5.0，明确按能力及反馈滚动规划。多目标主次、训练量取舍和确认流程保持。

后端职责分别保留在目标 policy／repository／service、生成上下文、阶段规划及复评模块；前端复用已有黑金表单和日期组件。移除字段不新增依赖。

## 数据与兼容

迁移：`20261113120000_remove_goal_deadline` 仅对 `training_goals.target_date` 执行 `DROP NOT NULL`，不删除列或历史值。新目标及下一目标写入 `NULL`；编辑旧目标保留历史日期。见 [数据说明](../data/ai-coach.md)。

兼容接受旧客户端有效 ISO 日期输入，但当前响应已调整，需要使用配套客户端。旧的目标幂等结果和阶段目标快照在解析时剔除旧字段；仅移除日期不会使既有目标版本或阶段安排失效。真正的目标版本、成员、主次或训练依据变化仍使草稿失效。

历史复评／周期复盘的指纹可能与新证据结构不同，继续规划前应重新读取并确认复评；历史记录仍可查看。旧 AI 草稿须通过现有新鲜度检查，必要时重新生成，不绕过安全校验。

鉴权、归属、事务、幂等、版本冲突检查及草稿 → 预览 → 确认不变；生成课程自动附带阶段的流程继续适用。

回退时优先回退应用业务规则，不直接恢复 `NOT NULL`：新建目标已允许空值，恢复非空约束前必须先制定历史兼容策略，不可批量填造假的达成日期。

## 验证

- 后端 `goal-deadline.e2e-spec.ts`、`goal-planning.e2e-spec.ts`：无日期创建／评估、旧输入忽略、新目标存空、幂等重试、旧截止日期之后生成阶段／课程、AI 上下文无日期、84 天上限及并发检查。
- 后端 `goal-deadline.policy.spec.ts`：历史阶段快照兼容、真实目标版本变化仍阻断、实际赛事日期仍必填。
- 后端 `stage-review.policy.spec.ts`：复评后可跨旧期限规划，过去日期仍拒绝。
- 移动端 `goal-lifecycle.test.tsx` 和 `initial-plan-flow.test.tsx`：不填日期建档、编辑及冲突重试保留输入、旧期限不阻断复评规划、确认前不写入。

### 2026-11-13 实际执行结果

命令在仓库根目录执行，标注 mobile／api 的命令分别在 `apps/mobile`／`apps/api` 目录执行。测试环境辅助脚本读取 `.env.test`，校验仅使用本机 `*_test` 数据库及 Redis DB 1；与仓库 `apps/api/test/run-integration.cjs` 使用相同的隔离约束。

| 检查            | 实际命令                                                                                                                                            | 结果                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 契约编译        | `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`                                                                                       | 通过                                                                   |
| 前后端类型      | `./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`；`./node_modules/.bin/tsc -p apps/mobile/tsconfig.json --noEmit`                       | 通过                                                                   |
| API Lint        | `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`                                                                      | 通过，无警告                                                           |
| Mobile Lint     | mobile：`./node_modules/.bin/eslint src app`                                                                                                        | 通过，无警告                                                           |
| 格式            | 对本任务变更的 TS／TSX／Markdown 文件执行 `./node_modules/.bin/prettier --check`                                                                    | 通过；`git diff --check` 通过                                          |
| Prisma          | api：`./node_modules/.bin/prisma generate`、`./node_modules/.bin/prisma validate`                                                                   | 通过                                                                   |
| 数据迁移        | `node /tmp/ridepilot-goal-dates-migrate.cjs test deploy`；同脚本 `dev deploy`，随后分别执行 `status`                                                | 开发库、测试库均已应用；全部 20 项迁移同步，不删除历史数据             |
| API 完整测试    | `node /tmp/ridepilot-course-stages-integration.cjs`                                                                                                 | 329 通过、2 项既有失败、1 跳过；本次相关目标／阶段及新增无期限回归通过 |
| API 策略复测    | 同辅助脚本 `--runTestsByPath test/goal-deadline.policy.spec.ts test/stage-review.policy.spec.ts test/skill-loader.spec.ts`                          | 15 项通过                                                              |
| Mobile 完整测试 | mobile：`./node_modules/.bin/jest --runInBand --testTimeout=15000`                                                                                  | 52 套件通过；438 项通过、10 项原有跳过                                 |
| API 构建        | `./node_modules/.bin/tsc -p apps/api/tsconfig.build.json`                                                                                           | 通过                                                                   |
| Web 构建        | mobile：`CI=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform web --max-workers 2 --output-dir /tmp/ridepilot-no-deadline-web-final` | 导出成功                                                               |

后端保留的两项既有失败与此前在未修改 HEAD 上复现的结果一致：

1. `assessments.e2e-spec.ts` 的 `subsequent range drafts carry review evidence and become blocked if the result changes`，期望旧的测试绑定阻断文字，但当前范围生成忽略旧测试绑定参数。
2. `plan-input-impact.e2e-spec.ts` 的 `stage warnings handle missing titles and identify the changed basis without false positives`，仍期望旧阶段警告文字。

没有删除或跳过这两项失败测试。真实供应商模型与真机操作未验证；自动测试使用可控模型输出验证上下文及确认流程。
