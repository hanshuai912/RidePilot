# 训练执行与周期复盘

## 目的与范围

将 PRD 3.5.5、M08 的「训练执行 → 周期复盘 → 选择下一步 → 草稿预览 → 确认应用 → 后续训练」集中在一个入口。沿用已有课程反馈、测试安排、AI 范围生成及版本应用能力，不新增自动生成或自动推进阶段。

## 操作路径

1. AI 教练概览或训练日历 →「训练执行与周期复盘」。默认展示账号时区最近七天，也可选择本周、上周或截至今天的连续 1–84 天。
2. 查看训练完成情况、时长、RPE、疲劳、FTP 实测和测试依据。未记录课程可直接填写反馈，保存后返回原复盘范围并重新读取。
3. 选择保留计划并前往训练，或进入测试安排/结果页面。两者均不触发训练生成；测试安排仍须按原流程确认。
4. 选择沿用目标、恢复训练、调整后续安排，填写后续日期和可选说明，再点击生成。资料缺失时引导到目标、基础资料或可训练时间页面；返回后仍须主动生成。
5. 通过任务 ID 查询状态。进入页面、返回、刷新和轮询只发送 GET；生成中可离开，历史中可继续查看。请求超时重试沿用同一请求和幂等键；已接受任务的重新生成使用新的键及 forceRegenerate。
6. 预览草稿保存的复盘依据、受影响课程和新课程；点击校验 → 准备应用 → 确认应用。正式应用前重查反馈、资料、关联测试和基础版本，已记录历史课程保留。
7. 应用后可前往下一周期训练、检查训练补给联动，或返回复盘历史查看应用版本和生成时依据。

## 统计口径与建议规则

- 计划课程来自所选期间当前正式版本，另补入已记录的原始发布课程；跨版本复制按稳定 activityWorkoutId 去重。没有完整的每日计划快照，曾被替换且未留下反馈的旧课程不追溯纳入分母。
- 完成率 = 完成课程数 / 计划课程数。部分完成、跳过、未记录分别列示；今天尚未记录的课程也会进入分母，未记录不视为失败。无课程返回 null。
- 计划/实际时长仅累加已填值，展示覆盖数量。实际时长包含额外训练记录；配对差值只比较同时有计划和实际时长的课程，缺失不补零，明确填写的零保留。
- RPE、疲劳分别按已填写样本求平均并展示样本数。当前最近三天反馈单列，可能在所选历史周期以外，不伪装成周期内反馈。
- FTP 展示最新两次实测的日期、来源和差值，不归因为周期效果，不预测达标日，不自动更新 FTP。
- 建议优先级：最近三天最新已填疲劳 ≥7 → 恢复；本周期最后两条已记录活动均部分完成/跳过 → 调整；周期内有晚于当前计划应用时间的已完成测试 → 先复评；缺周期记录或近期疲劳 → 依据不足；否则可沿用目标。RPE 不替代疲劳，不据此推断生理状态。
- 阶段须匹配当前目标、档案、FTP、可训练时间版本且与复盘期间重叠，否则不作为有效阶段依据。
- 后续训练从今天或未来开始，必须晚于复盘结束日，最长 84 天，不超过所选活跃主目标日期。恢复草稿所有区段上限不超过 70% FTP，生成及手工编辑后的校验都执行该规则；原有时间、日期和恢复间隔规则继续适用。

## 技术实现

- 契约：`packages/contracts/src/cycle-review.ts`；生成请求的 cycleReview 引用仅携带日期、action 和 SHA-256 fingerprint。客户端不能提供完整复盘证据。
- API：`apps/api/src/modules/coach/cycle-review/`，按 repository、聚合规则、证据校验、service、controller 拆分。概览和历史使用 Repeatable Read，只读且不调用模型。
- 原有 `CoachGenerationContextService` 在提交、执行和保存候选前重新计算复盘，模型获得真实快照。`CoachProposalService` 在校验和应用前再核对；建议列表对依据失效的待处理草稿只读投影为历史 EXPIRED。
- Mobile：`apps/mobile/src/features/coach/cycle-review/` 独立 API、hook、页面和展示组件，现有教练页只增加入口，复用 PlanPreview 和建议确认应用。
- 同账号、场景、完整输入复用任务/有效草稿；明确重新生成可替换同复盘期间、同动作和同后续范围的候选。失败不替代原有效草稿。应用继续使用用户锁、事务、基础版本及草稿版本检查。

## API

统一前缀 `/api/v1`，全部要求 JWT，并按当前用户隔离。

| Method | Path                                       | 输入 / 输出                                                                       |
| ------ | ------------------------------------------ | --------------------------------------------------------------------------------- |
| GET    | `/ai-coach/cycle-review`                   | 可选且须同时提供 startDate/endDate；返回 CycleReviewSnapshot                      |
| GET    | `/ai-coach/cycle-review/history`           | 最近 30 次复盘生成；包含任务、草稿状态、review 引用、后续范围、保存依据和应用版本 |
| POST   | `/ai-coach/cycle-review/generate-proposal` | Idempotency-Key；CycleReviewGeneration；202 返回现有异步任务响应                  |

生成输入包含 review `{startDate,endDate,fingerprint,action:CONTINUE/RECOVERY/ADJUST}`、goalId、startDate/endDate（后续训练）、expectedBaseVersion、可选 notes/forceRegenerate。草稿响应增加可选 cycleReview `{action,snapshot}`，其他场景兼容。

主要错误：400 INVALID_REVIEW_RANGE / INVALID_CYCLE_TARGET_RANGE / FTP_REQUIRED / INSUFFICIENT_TRAINING_INPUT；409 CYCLE_REVIEW_STALE / PLAN_VERSION_CONFLICT；任务错误 CYCLE_RECOVERY_INTENSITY / GENERATION_CONTEXT_CHANGED / 原有 AI 错误。读取失败可重试，历史读取失败不隐藏当前复盘，生成失败保留表单和历史入口。

## 数据与迁移

无 Prisma schema 变更，无需新迁移。复用 AiGeneration.input.cycleReview 保存引用；成功的 ChangeProposal.draft.cycleReview 保存不可由草稿编辑接口修改的生成时证据。应用版本从 appliedVersionId 追溯。

历史只记录主动生成，不记录每次浏览、保留计划或测试页面跳转。失败任务有 action、期间、目标范围和错误码；完整复盘证据在成功生成草稿后保存，失败任务不声称有完整快照。历史最多 30 条，当前不提供分页。跨当地日期、训练反馈、测量、目标、测试、资料或正式版本变化可能使未应用草稿失效；需刷新复盘后主动生成。

## 验证

- `apps/api/test/cycle-review-policy.spec.ts`：无数据、疲劳与 RPE 区别、建议优先级、证据指纹、任务范围、时区午夜。
- `apps/api/test/cycle-review.e2e-spec.ts`：真实测试库中的反馈到应用闭环、重复点击、历史、跨用户、缺资料、日期、模型执行中证据变化、应用前失效、恢复强度和失败后保留候选。
- `apps/mobile/src/features/coach/__tests__/cycle-review.test.tsx`：进入不生成、选择与主动提交、超时幂等重试、任务恢复、错误提示、资料引导、历史失败隔离、预览校验确认和进入后续训练。
  实际执行（2026-11-05）：

- `pnpm typecheck`、`pnpm lint`、`pnpm build`：通过。pnpm 在沙箱内无法打开自身数据库文件，以上命令在获授权的沙箱外运行；最后修改后另跑移动端 `tsc --noEmit`、API `tsc -p apps/api/tsconfig.json --noEmit` 及 lint，均通过。
- `cd apps/mobile && ./node_modules/.bin/jest --runInBand`：30 组、279 项通过。
- `cd apps/api && ./node_modules/.bin/jest --runInBand`：25 组、144 项通过；13 组、89 项需数据库/额外环境而跳过，没有把跳过计为通过。
- `node /tmp/ridepilot-cycle-review-integration.cjs`：读取测试环境并验证仅连接本地 *_test PostgreSQL / Redis DB 1 后执行 `jest --runInBand --runTestsByPath test/cycle-review.e2e-spec.ts`，1 组、9 项通过，包含无正式计划时主动建立首份计划。
- `node /tmp/ridepilot-lifecycle-integration.cjs`：同样检查测试环境，执行 generation-lifecycle、coach-center、coach、nutrition、goal-planning、training-nutrition 六个数据库套件，6 组、48 项通过。
- `git diff --check` 与本次新增文件的 Prettier 检查：通过。

上述 `/tmp` 文件是本次验证的临时运行器；仓库持久入口 `apps/api/test/run-integration.cjs` 可读取同一隔离环境执行完整集成测试。数据库运行器执行前均检查本地测试库和 Redis DB 1，不使用开发或生产账号。测试中模型使用替身；未进行真机或真实模型质量验收。现有 PostgreSQL 驱动的同连接并行查询弃用提示仍存在，未影响断言结果。

## 边界

本入口不会自动激活下一阶段、安排测试或修改 FTP；这些仍走各自确认流程。尚未接入设备活动/TSS，也没有用缺失数据估算训练负荷、能力增长或恢复结论。
