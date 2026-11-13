# 训练执行与周期复盘（旧版）

> 2026-11-11 后续调整：页面已重新定位为“训练历史”，入口移到“我的”，原复盘筛选、汇总与建议全部移除；旧路由重定向至训练历史。当前实现与验证以 [训练历史](training-history.md) 为准。以下保留旧版复盘及服务端兼容能力的历史说明。

> 此前 2026-11-11：本页集中查看训练执行与周期复盘，不再提供反馈录入或生成、恢复、调整后续训练的操作。页面不展示后续训练引导、历史计划或历史任务状态，只保留复盘数据。测试结果不进入新的周期复盘生成依据。

## 目的与范围

提供 PRD 3.5.5、M08 的训练执行与周期复盘视图：选择时间范围，查看完成率、计划与实际时长、主观强度、疲劳、FTP 实测和复盘建议。复盘页只读取数据；课程详情负责反馈录入，AI 教练负责后续训练规划、恢复和调整。沿用现有统计口径与黑金样式。复盘页不再展示后续训练引导或“复盘与后续计划历史”。

## 操作路径

1. AI 教练概览或训练日历 →「训练执行与周期复盘」。默认展示账号时区最近七天，也可选择本周、上周或截至今天的连续 1–84 天。
2. 查看完成率、计划/实际时长、RPE、疲劳、FTP 实测及复盘建议。“本周期执行明细”只展示已有训练反馈与额外记录；未记录明确标注“不视为失败”，本页不提供反馈录入按钮。
3. 可查看周期内测试详情；不在复盘页安排测试或复评目标。
4. 复盘页不显示后续训练引导、生成按钮、后续训练日期、备注、资料补全、历史列表或任务状态；不读取历史和生成任务，也不提交生成、取消或正式计划修改请求。
5. 切换复盘范围或重试只读取复盘数据。读取失败可重试，也可返回最近七天。旧链接中的 generationId 不再触发任务读取。AI 教练建议列表仍能查看已有草稿，旧复盘草稿的预览、校验与确认应用继续使用原建议流程，返回按钮改为“返回周期复盘”。

## 统计口径与建议规则

- 计划课程来自所选期间当前正式版本，另补入已记录的原始发布课程；跨版本复制按稳定 activityWorkoutId 去重。没有完整的每日计划快照，曾被替换且未留下反馈的旧课程不追溯纳入分母。
- 完成率 = 完成课程数 / 计划课程数。部分完成、跳过、未记录分别列示；今天尚未记录的课程也会进入分母，未记录不视为失败。无课程返回 null。
- 计划/实际时长仅累加已填值，展示覆盖数量。实际时长包含额外训练记录；配对差值只比较同时有计划和实际时长的课程，缺失不补零，明确填写的零保留。
- RPE、疲劳分别按已填写样本求平均并展示样本数。当前最近三天反馈单列，可能在所选历史周期以外，不伪装成周期内反馈。
- FTP 展示最新两次实测的日期、来源和差值，不归因为周期效果，不预测达标日，不自动更新 FTP。
- 建议优先级：最近三天最新已填疲劳 ≥7 → 恢复；本周期最后两条已记录活动均部分完成/跳过 → 调整；缺周期记录或近期疲劳 → 依据不足；否则可沿用目标。RPE 不替代疲劳，不据此推断生理状态。
- 阶段须匹配当前目标、档案、FTP、可训练时间版本且与复盘期间重叠，否则不作为有效阶段依据。
- 旧版复盘生成接口的兼容规则：后续训练从今天或未来开始，必须晚于复盘结束日，最长 84 天，不受历史目标日期限制。恢复草稿所有区段上限不超过 70% FTP，生成及手工编辑后的校验都执行该规则；原有时间、日期和恢复间隔规则继续适用。

## 技术实现

- 契约：`packages/contracts/src/cycle-review.ts`；生成请求的 cycleReview 引用仅携带日期、action 和 SHA-256 fingerprint。客户端不能提供完整复盘证据。
- API：`apps/api/src/modules/coach/cycle-review/`，按 repository、聚合规则、证据校验、service、controller 拆分。概览和历史使用 Repeatable Read，只读且不调用模型。
- 原有 `CoachGenerationContextService` 在提交、执行和保存候选前重新计算复盘，模型获得真实快照。`CoachProposalService` 在校验和应用前再核对；建议列表对依据失效的待处理草稿只读投影为历史 EXPIRED。
- Mobile：`apps/mobile/src/features/coach/cycle-review/` 按 API、hook、页面和展示组件拆分。`useCycleReview` 只读取所选范围的复盘，不再请求历史或任务、轮询任务、维护生成表单或取消状态。移除 `CycleReviewActions` 与 `CycleReviewHistory`，不保留后续训练引导。已有草稿在 AI 教练建议页面继续复用 PlanPreview 和建议确认应用。
- 同账号、场景、完整输入复用任务/有效草稿；明确重新生成可替换同复盘期间、同动作和同后续范围的候选。失败不替代原有效草稿。应用继续使用用户锁、事务、基础版本及草稿版本检查。

## API

当前移动端复盘页仅调用 `GET /ai-coach/cycle-review`。历史和生成接口保留服务端兼容，本次不修改契约或数据库。

统一前缀 `/api/v1`，全部要求 JWT，并按当前用户隔离。

| Method | Path                                       | 输入 / 输出                                                                       |
| ------ | ------------------------------------------ | --------------------------------------------------------------------------------- |
| GET    | `/ai-coach/cycle-review`                   | 可选且须同时提供 startDate/endDate；返回 CycleReviewSnapshot                      |
| GET    | `/ai-coach/cycle-review/history`           | 最近 30 次复盘生成；包含任务、草稿状态、review 引用、后续范围、保存依据和应用版本 |
| POST   | `/ai-coach/cycle-review/generate-proposal` | Idempotency-Key；CycleReviewGeneration；202 返回现有异步任务响应                  |

生成输入包含 review `{startDate,endDate,fingerprint,action:CONTINUE/RECOVERY/ADJUST}`、goalId、startDate/endDate（后续训练）、expectedBaseVersion、可选 notes/forceRegenerate。草稿响应增加可选 cycleReview `{action,snapshot}`，其他场景兼容。

主要错误：400 INVALID_REVIEW_RANGE / INVALID_CYCLE_TARGET_RANGE / FTP_REQUIRED / INSUFFICIENT_TRAINING_INPUT；409 CYCLE_REVIEW_STALE / PLAN_VERSION_CONFLICT；任务错误 CYCLE_RECOVERY_INTENSITY / GENERATION_CONTEXT_CHANGED / 原有 AI 错误。复盘读取失败可重试或返回最近七天；本页没有历史、任务状态和重新生成操作。

## 数据与迁移

无 Prisma schema 变更，无需新迁移。复用 AiGeneration.input.cycleReview 保存引用；成功的 ChangeProposal.draft.cycleReview 保存不可由草稿编辑接口修改的生成时证据。应用版本从 appliedVersionId 追溯。

历史只记录主动生成，不记录每次浏览、保留计划或测试页面跳转。失败任务有 action、期间、目标范围和错误码；完整复盘证据在成功生成草稿后保存，失败任务不声称有完整快照。历史最多 30 条，当前不提供分页。跨当地日期、训练反馈、测量、目标、测试、资料或正式版本变化可能使未应用草稿失效；需刷新复盘后主动生成。

## 验证

### 2026-11-11：复盘页精简

- 移除训练反馈录入、三类训练生成及其日期/备注/资料补全表单、后续训练引导和“复盘与后续计划历史”。页面仅保留范围、统计、建议、执行明细及测试依据。
- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/cycle-review.test.tsx src/features/coach/__tests__/coach-center.test.tsx src/features/training/__tests__/training-routes.test.tsx`：3 组、72 项通过。覆盖入口和表单移除、旧任务参数不读取历史/任务、空数据、失败重试、日期范围恢复，以及 AI 教练原有操作和课程详情反馈流程。
- `./node_modules/.bin/tsc --noEmit`、本次相关文件 ESLint、Prettier 检查及 `git diff --check` 均通过。
- `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-cycle-review-simplified-web --max-workers 2`：Web 构建导出通过。
- 本次无 API、共享契约、数据库或依赖变更；未执行真机验收。

### 相关自动化覆盖

- `apps/api/test/cycle-review-policy.spec.ts`：无数据、疲劳与 RPE 区别、建议优先级、证据指纹、任务范围、时区午夜。
- `apps/api/test/cycle-review.e2e-spec.ts`：真实测试库中的反馈到应用闭环、重复点击、历史、跨用户、缺资料、日期、模型执行中证据变化、应用前失效、恢复强度和失败后保留候选。
- `apps/mobile/src/features/coach/__tests__/cycle-review.test.tsx`：反馈与生成入口/表单移除、后续引导与历史移除、已有反馈与额外记录展示、空周期、复盘范围错误恢复、只请求复盘且忽略旧任务 ID，以及 AI 教练中旧草稿的预览校验确认。

### 此前完整流程验证（2026-11-05）

- `pnpm typecheck`、`pnpm lint`、`pnpm build`：通过。pnpm 在沙箱内无法打开自身数据库文件，以上命令在获授权的沙箱外运行；最后修改后另跑移动端 `tsc --noEmit`、API `tsc -p apps/api/tsconfig.json --noEmit` 及 lint，均通过。
- `cd apps/mobile && ./node_modules/.bin/jest --runInBand`：30 组、279 项通过。
- `cd apps/api && ./node_modules/.bin/jest --runInBand`：25 组、144 项通过；13 组、89 项需数据库/额外环境而跳过，没有把跳过计为通过。
- `node /tmp/ridepilot-cycle-review-integration.cjs`：读取测试环境并验证仅连接本地 *_test PostgreSQL / Redis DB 1 后执行 `jest --runInBand --runTestsByPath test/cycle-review.e2e-spec.ts`，1 组、9 项通过，包含无正式计划时主动建立首份计划。
- `node /tmp/ridepilot-lifecycle-integration.cjs`：同样检查测试环境，执行 generation-lifecycle、coach-center、coach、nutrition、goal-planning、training-nutrition 六个数据库套件，6 组、48 项通过。
- `git diff --check` 与本次新增文件的 Prettier 检查：通过。

上述 `/tmp` 文件是本次验证的临时运行器；仓库持久入口 `apps/api/test/run-integration.cjs` 可读取同一隔离环境执行完整集成测试。数据库运行器执行前均检查本地测试库和 Redis DB 1，不使用开发或生产账号。测试中模型使用替身；未进行真机或真实模型质量验收。现有 PostgreSQL 驱动的同连接并行查询弃用提示仍存在，未影响断言结果。

## 边界

本入口不会自动激活下一阶段、安排测试或修改 FTP；这些仍走各自确认流程。尚未接入设备活动/TSS，也没有用缺失数据估算训练负荷、能力增长或恢复结论。
