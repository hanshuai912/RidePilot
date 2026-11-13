# 生成课程时自动配套阶段

## 目的与用户流程

2026-11-13，按用户要求，生成课程时一并准备阶段安排，用户不再需要确认课程后再次生成阶段。覆盖首周、空白周、按日期／阶段生成的课程及赛事训练生成；单课调整、手动课程和普通调整沿用已有流程。此次需求优先于旧文档中“阶段与课程必须分别确认”的描述。

选择日期或阶段 → 生成课程与阶段候选 → 同页核对 → 校验 → 一次确认 → 课程和阶段在同一事务内生效。阶段独立规划入口保留，适用于只修改长期路线图；测试建议仍不会创建测试日程。

服务端根据全部进行中目标、FTP、档案和可训练时间，决定：

| 情况                              | 行为                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| 没有正式阶段                      | `CREATE`：随课程建立覆盖本次日期的阶段，按本次所选范围规划课程           |
| 有效阶段覆盖课程日期              | `REUSE`：使用已有阶段目的指导课程，保留原安排与版本                      |
| 有效阶段覆盖不足                  | `EXTEND`：补齐前后日期，包含中间缺口；保留原阶段内容、ID、测试与复评关联 |
| 目标／FTP／资料变化导致原阶段失效 | `REPLACE`：预览中明示；确认时归档旧安排，建立与新课程配套的阶段          |

周计划从当地今天或所选周起始日中较晚的一天建立阶段；课程仍遵守原周一规则、日期范围与训练日校验。新路线图覆盖本次课程范围；有效旧路线图扩展后保留其完整范围。阶段总范围最长 365 天，最多 12 个阶段，每阶段最长 84 天；超出上限会拒绝草稿，需要另行规划阶段。日期结束不代表达成目标。

## 实现、契约与数据

- `packages/contracts/src/stage-output.ts` 统一阶段结构，避免 coach 与 stages 的循环导入。`AiWeekOutput.stages` 为可选结构化阶段；`AiProposalResponse.stagePlan` 返回 `action`、摘要、起止日期和阶段数组。客户端课程编辑不接受 `stages`，不能夹带阶段修改。
- `course-stage-planning.ts` 构建候选，校验连续覆盖、重叠、完整性与长度。旧模型适配器未返回结构化阶段时，将其已有的阶段方向和复评建议转为每段最多 84 天的阶段，不额外调用模型。目的及建议受数据库 300 字限制，完整阶段方向保留在摘要中；这不是自动能力评估。
- `course-stage.repository.ts` 读取正式阶段基准、检查版本并在课程发布事务内创建／扩展。扩展先移到未使用位置再重排，避免阶段位置唯一约束冲突，并保留原阶段 ID。
- `CoachGenerationContextService` 将已有阶段和期望范围提供给模型；`AiGenerationService` 在现有可取消任务里同时准备候选。生成期间依据变化会拒绝结果，未确认阶段只存在 `ChangeProposal.draft.courseStages` 中。
- `CoachProposalService` 返回阶段预览、校验阶段基准，并在既有用户行锁、计划版本校验、幂等发布事务内同时写阶段和课程。任一写入失败，二者回滚；已经成功的相同提案重试返回原结果，不重复创建阶段。
- 独立阶段草稿的 `goalsSnapshot.baseStagePlanVersion` 记录生成时的正式阶段版本，防止课程补齐阶段后旧独立草稿仍能覆盖新安排。历史无该值的草稿在正式阶段超过初始激活版本 v2 后失效。
- `CourseStagePreview` 展示阶段变化；新建、替换和扩展默认展开，沿用默认收起。课程预览的确认操作明确为“确认应用课程与阶段”，失败保留预览及幂等请求。其他共用课程预览入口同样显示阶段影响。
- 模型适配规则更新至 1.5.0（训练目标无达成期限），仍采用既有供应商适配器和共享安全规则。超大既有 service 保留原事务／任务编排，新阶段业务拆到独立文件，避免复制发布逻辑。

不新增接口、数据库表、字段或迁移。复用现有阶段表及草稿 JSON；旧课程草稿没有 `stagePlan` 时保持原确认语义，不在查看或应用旧草稿时补写未经预览的阶段。旧已生成草稿不会被新任务自动复用为含阶段的候选；原幂等键仍返回原任务。

## 安全与失败状态

继续验证用户归属、全部目标快照、FTP、档案、可训练时间、正式课程版本、阶段版本，以及已记录课程保护。首次读取、生成、校验、确认失败沿用已有错误与重试流程。新阶段不会自动创建测试，也不会改写能力值或确认目标达成。

## 测试与验证

新增 `course-stage-planning.spec.ts`、`course-stage-generation.e2e-spec.ts`，扩展移动端 `proposal-presentation.test.tsx` 与 `goal-planning.test.tsx`。覆盖结构化阶段、旧模型结果适配、连续性、新建／沿用／扩展／失效替换、多目标首周、权限、事务回滚、重复提交、独立阶段与课程并发冲突、预览无写入，以及网络失败后相同请求重试。

2026-11-13 实际执行（未特别标注时在仓库根目录）：

| 命令                                                                                                                                                                                                                | 结果                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`                                                                                                                                                       | 契约构建通过                                                                           |
| `./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`                                                                                                                                                        | API 类型检查通过                                                                       |
| `./node_modules/.bin/tsc -p apps/mobile/tsconfig.json --noEmit`                                                                                                                                                     | 移动端类型检查通过                                                                     |
| `./node_modules/.bin/tsc -p apps/api/tsconfig.build.json`                                                                                                                                                           | API 构建通过                                                                           |
| `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`                                                                                                                                      | 通过                                                                                   |
| 移动端 `./node_modules/.bin/eslint src app`                                                                                                                                                                         | 通过                                                                                   |
| API `./node_modules/.bin/jest --runInBand --runTestsByPath test/ai-generation-worker.spec.ts test/race-training-context.spec.ts test/course-stage-planning.spec.ts test/stage-plan.spec.ts test/coach-plan.spec.ts` | 5 组、31 项通过                                                                        |
| `node /tmp/ridepilot-course-stages-integration.cjs --runTestsByPath test/course-stage-generation.e2e-spec.ts test/goal-planning.e2e-spec.ts test/unified-goal-planning.e2e-spec.ts`                                 | 3 组、29 项通过                                                                        |
| 移动端 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/proposal-presentation.test.tsx src/features/goals/__tests__/goal-planning.test.tsx`                                      | 2 组、37 项通过                                                                        |
| 移动端 `./node_modules/.bin/jest --runInBand --testTimeout=15000 --json --outputFile=/tmp/ridepilot-course-stages-mobile-tests.json`                                                                                | 全量 52 组、437 项通过，原有 10 项跳过                                                 |
| `node /tmp/ridepilot-course-stages-integration.cjs`                                                                                                                                                                 | API 全量 48 组通过、2 组失败、1 组跳过；326 项通过、2 项失败、1 项跳过，未宣称全量通过 |
| 移动端 `CI=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform web --max-workers 2 --output-dir /tmp/ridepilot-course-stages-web`                                                                      | Web 导出通过                                                                           |

临时集成脚本读取 `apps/api/.env.test`，校验仅连接本机 `_test` PostgreSQL 与 Redis DB 1，然后执行 API Jest；没有迁移或操作开发账号数据。事务回滚用例故意在事务内抛出课程写入错误，预期返回 500，并验证阶段、课程、正式计划和草稿状态全部回滚；输出中的模拟错误是该测试的一部分。pg 并行查询有既有弃用提示。

API 两项全量失败均已在 `/tmp/ridepilot-course-stages-baseline` 的未修改 `HEAD` 代码上单独复现，未修改或跳过失败测试：

- `assessments.e2e-spec.ts` 的 `subsequent range drafts carry review evidence and become blocked if the result changes`：旧用例期待范围草稿绑定测试版本，而现有范围生成已忽略旧测试参数，缺少预期阻断。
- `plan-input-impact.e2e-spec.ts` 的 `stage warnings handle missing titles and identify the changed basis without false positives`：期待的阶段警告文案与当前实现不一致。

基线执行：`node /tmp/ridepilot-course-stages-baseline-test.cjs --runTestsByPath test/assessments.e2e-spec.ts --testNamePattern 'subsequent range drafts carry review evidence'`（第一次运行时该参数在脚本内固定）和 `node /tmp/ridepilot-course-stages-baseline-test.cjs --runTestsByPath test/plan-input-impact.e2e-spec.ts --testNamePattern 'stage warnings handle missing titles'`，分别复现同一项失败。

修改文件执行 Prettier 检查及 `git diff --check`。真实模型输出质量、浏览器截图及 Android／iOS 真机尚未验收。
