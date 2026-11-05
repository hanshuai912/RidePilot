# 教练建议生命周期与生成去重

## 目的与操作路径

完成 AI 教练已有建议的处理闭环，避免失效草稿持续占用待处理数量，以及重复点击生成堆积候选。用户仍主动点击生成、校验、确认应用；进入页面和刷新只读取数据。本次不增加疲劳、比赛或测试变化的主动建议触发器。

- AI 教练 → 查看全部建议与历史：有效草稿在待处理中；过期、资料或正式版本失效的草稿进入历史，显示原因。历史只读预览不提供应用按钮。
- AI 教练 → 快捷任务 → 生成：相同输入优先恢复已存在的任务或有效候选。候选页点击“重新生成草稿”才请求新候选。
- 目标 → 目标详情：普通生成恢复已有候选；“重新生成课程草稿”“重新生成阶段草稿”显式请求新候选。
- 赛事、训练联动补给继续沿用原有生成与重新生成入口。已应用方案的恢复规则保留。
- 在教练中心确认应用训练或补给后刷新关联建议；有失效建议时显示数量，并可返回历史看原因。刷新失败不会把已提交成功的应用误报为失败，返回列表会再次读取。

## 规则与实现

`infra/prisma/generation-candidates.ts` 统一请求内容指纹、任务范围和候选替代规则。训练、阶段及补给生成服务分别执行领域校验，不合并进列表服务或页面。

1. 相同账号、场景、输入（忽略 `forceRegenerate`）在用户行锁事务内复用 QUEUED/RUNNING 任务；普通请求还可恢复当前有效的候选。正式基准版本、目标、日期、课程/赛事/测试、阶段、原因、备注均参与请求身份。资料改变后不能复用旧候选。
2. 幂等键仍按原请求校验：同一个已持久化键用于不同输入返回409。内容相同但新键的请求可以直接恢复旧任务，不额外创建任务或保存键别名。客户端应保留响应中的 generationId 继续查询；任务失败后主动重试应使用新键。
3. 成功且可用的新候选保存后，在同一事务中替代同任务范围的旧候选。任务范围包含场景、模式、目标、日期、阶段、单节课程、关联事件及赛事阶段；备注和基础版本不区分替代范围。其他日期、目标或任务不受影响。
4. 请求创建顺序决定新旧，同毫秒以 ID 排序。较旧 worker 晚完成时不能替代较新的有效结果；较新的失效或 BLOCKED 结果不能挤掉当前有效候选。FAILED、重试和 BLOCKED 新结果均不替代原可用候选。
5. worker 在模型返回后锁用户、重读上下文并比较指纹，变化则以 `GENERATION_CONTEXT_CHANGED` 失败；不保存基于调用前资料的候选。最终应用仍重验状态、归属、草稿版本、正式版本及领域规则。
6. 训练/补给旧候选使用既有 EXPIRED 状态，增加 proposalVersion、清除 validationPassed，并把替代原因写入 validationBlockers。阶段旧候选使用 String 状态 SUPERSEDED 并增加 version；已应用/已确认方案不参与替代。
7. GET 建议列表只做失效投影，不修改原记录。待处理必须同时符合状态与有效性。历史含所有本次发现的失效待处理草稿，再加最近十条终态记录，避免较早的失效原因被近期记录挤掉。已应用/已放弃记录不显示后来版本变化的失效原因。

新 AI 训练草稿记录内部 `contextFingerprint`。新营养提案 metadata 记录可选 `generationContext`，含上下文指纹、用户与营养档案版本、正式训练版本 ID、可选赛事 ID/版本；应用时重新检查。旧营养草稿没有该快照时，继续按已有基础版本和领域校验判断，不能追溯不存在的历史档案版本。

## API、数据与兼容性

没有新增端点和数据库迁移。使用已有 AiGeneration、ChangeProposal、NutritionProposal 和 TrainingStagePlan；补充共享 Zod 契约并同步前后端。

- 周/调整/范围/阶段生成支持可选 `forceRegenerate`，仅显式重新生成传 true。`racePhase` 仍只能用于赛事场景。
- `GET /ai-coach/suggestions` 的 status 可为 EXPIRED 或 SUPERSEDED；阶段详情状态增加 SUPERSEDED。
- `recent` 不再保证最多十条：十条终态历史之外保留所有当前失效草稿。
- 到期草稿在应用时返回409 `PROPOSAL_EXPIRED`；新营养生成快照变化返回409 `NUTRITION_GENERATION_STALE`。既有训练联动的 `PLAN_VERSION_CONFLICT` 检查优先级保留。
- 更新 API 与移动端时同步发布共享契约；老版本严格解析 metadata 的客户端不认识新增字段。

## 测试与边界

主要测试：`apps/api/test/generation-lifecycle.e2e-spec.ts`、`coach-center.e2e-spec.ts`、`goal-planning.e2e-spec.ts`、`training-nutrition.e2e-spec.ts`，以及移动端 coach-center、initial-plan-flow、goal-planning 交互测试。覆盖并发重复点击、READY 恢复、显式重生成、失败/阻断保留旧候选、作用域隔离、晚完成顺序、生成中资料变化、旧候选不可应用、确认应用后关联失效、只读历史与鉴权归属。

数据库测试使用本机隔离测试库和模型 stub；不表示真机或真实模型端到端验证。完整历史分页和任务取消仍待后续实现。

## 本次实际验证

- 根目录 `pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过。pnpm 缓存数据库在沙箱内不可访问，三项通过授权在沙箱外执行；没有安装新依赖。
- `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand`：29 组、267 项通过。
- `apps/api` 执行同一 Jest 命令：24 组、137 项通过；12 组、80 项因数据库/真实模型条件未启用而跳过。
- `apps/api` 执行 `node /tmp/ridepilot-lifecycle-integration.cjs`：本机隔离测试库运行 lifecycle、coach-center、coach、nutrition、goal-planning、training-nutrition 六组，47 项通过；随后新增营养档案变更用例，`node /tmp/ridepilot-lifecycle-focused.cjs` 重跑 lifecycle 十项全部通过。包装脚本只加载 `.env.test`，限制数据库为本机 `*_test`、Redis 为本机 DB1，调用 Jest `--runInBand --runTestsByPath`；其余五组未因该新增测试重复运行。
- 额外执行 API `tsc --noEmit`、`oxlint`、改动文件 Prettier 和 `git diff --check`。
- 使用构建后的列表服务，只读复核此前授权排查的账号：新逻辑待处理0条、失效历史18条（训练13、营养5）。数据库连接强制 `default_transaction_read_only=on`，前后提案状态、版本和更新时间一致，没有清理或改写账号数据。

现有训练、阶段与营养生成服务保留各自模型编排、worker 重试和应用前草稿保存事务，避免这次改动移动整个既有工作流；输入上下文、领域验证、公共候选持久化策略和营养快照校验已分开维护。移动端已有大页面/建计划 hook 仅接入按钮和参数，建议读取与预览状态位于独立组件和 hook。
