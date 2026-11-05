# AI 教练持续协作中心

## 目的与范围

落实 PRD 3.5.1、FR-802：已有正式计划的用户进入 AI 教练后，先了解当前阶段、状态依据及下一训练/测试，再选择问答或处理建议。保留首次建计划流程；没有正式计划时也可找回已生成的建议。

本次接入真实 API 和持久化草稿，进入页面、刷新和轮询均只读。生成、校验、应用由用户点击触发；自由问答不会创建或应用训练、饮食、阶段或测试。

## 操作路径

1. 底部「AI 教练」：查看主目标、阶段名称/目的/起止日期、状态和近七天证据。
2. 「查看下一训练」进入真实课程详情；「查看测试 / 录入结果」进入测试详情。没有测试时可主动安排测试。
3. 「问 AI 教练」输入问题并发送，支持追问。模型读取最新本人概览和最近三轮对话；失败保留输入。问答在当前页面内存中保存，最多展示十轮，离开后不承诺恢复。
4. 「待处理建议」恢复训练调整、赛事训练、测试复评、饮食/赛事补给及阶段草稿。「查看全部建议与历史」展示完整待处理列表与最近十条终态记录。
5. 训练/饮食建议按 ID 加载预览，先点击「校验这份建议」，再点击「预览完成，准备应用」，最后确认应用。基于用户预览的正式版本和草稿版本提交；失败保留预览与刷新入口。训练应用成功可继续检查训练补给联动。
6. 阶段草稿复用阶段预览及确认页面；确认阶段不会自动创建课程或测试。
7. 「放弃建议」需要二次确认，也可选择保留。生成中的任务每四秒只读刷新；离开页面停止轮询，服务端任务继续。成功后出现可恢复的草稿，失败展示重试指引。

## 状态依据

- 日期以账号时区为准；概览在 Repeatable Read 事务中读取同一快照。
- 证据来自最近七天实际训练活动、比赛结果和已完成测试，最多展示十条，标注日期、RPE 和疲劳；缺项不推测。
- 最近三天最新已填疲劳 ≥7/10，展示「建议关注恢复」；低于7展示「近期疲劳反馈平稳」。同一天按记录时间选择最新反馈；RPE 不等同于疲劳。
- 最近七天有更新时间晚于当前计划应用时间的测试结果，提示「建议复评」；高疲劳反馈优先提示恢复。
- 最近三天没有疲劳反馈，展示「暂无充分状态依据」。这些是透明的主观反馈摘要规则，不是完整生理状态评估。
- 阶段读取主目标已确认的安排；目标、资料、FTP 或时间版本变化后提示检查，不把旧阶段当作当前有效阶段。尚未开始的阶段标为「下一阶段」。
- 下一课程只取正式活动版本中当地今天起未记录的课程，跳过完成、部分完成和跳过反馈，包括跨计划版本的稳定活动引用；没有固定未来日期上限。
- 最早未处理测试优先，过期日程标为已到期；阶段建议文字不会伪装为测试日程。
- 最近五个已应用计划版本展示版本、时间和原因，标识当前执行版本；本页暂不提供版本恢复操作。

## 技术与 API

共享契约：`packages/contracts/src/coach-center.ts`；问答扩展在 `coach.ts`。

服务端在 `CoachModule` 内按概览查询、状态规则、建议查询 repository、建议生命周期和控制器拆分；`CoachChatService` 复用概览及已有 AI 编排器/Skill。所有读取和写入按当前登录用户隔离。

移动端新增 `CoachOverviewPanel`、`CoachSuggestionsPanel`、独立问答和建议预览 screens，以及专用 API/hooks。`CoachScreen` 仅装配，不扩大原始建计划 hook 的业务范围。沿用仓库已有 focus-based resource hook 模式，无新增依赖。

| Method | Path                                | 行为                                                                               |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------- |
| GET    | `/ai-coach/overview`                | 本人目标、阶段、状态依据、下一训练/测试、最多十四节未来未记录课程和最近版本        |
| GET    | `/ai-coach/suggestions`             | 本人 pending 与 recent；只限制终态历史数量，不让较早待处理草稿被新记录挤掉         |
| POST   | `/ai-coach/suggestions/:id/dismiss` | `{kind: TRAINING/NUTRITION/STAGE, expectedVersion}`，返回 `{dismissed:true}`       |
| POST   | `/ai-coach/chat`                    | `{message, history?}`，只读答复；history 最多六条 user/assistant，禁止 system 角色 |

应用复用已有训练/饮食接口，新增可选 `expectedProposalVersion`。教练中心总是发送；不匹配返回 `409 PROPOSAL_VERSION_CONFLICT`。已经应用的提案重复请求返回原结果，旧调用方兼容。

## 数据、并发与异常

无 Prisma schema 或迁移变化。复用 TrainingGoal、TrainingStagePlan、TrainingActivity、TrainingAssessment、TrainingRaceResult、PlanVersion、ChangeProposal、NutritionProposal、AiGeneration。

放弃操作在事务中锁用户，检查归属、状态及版本，以条件更新防止并发覆盖。训练/营养变为 REJECTED 并增加 proposalVersion；阶段变为 ARCHIVED 并增加 version。相同版本重复放弃幂等成功；已应用、已确认或其他版本返回409，跨用户/不存在返回404。

列表根据到期时间、正式训练/饮食版本、训练上下文、目标/FTP/时间/资料及关联赛事/测试版本解释可识别的失效原因，不通过只读请求改写状态。最终应用资格仍由现有领域校验与应用事务决定。

概览、建议读取失败分别展示错误与重试，不挡住快捷任务；应用失败不会显示成功。普通请求十二秒超时，模型问答客户端九十秒超时，失败保留输入。模型服务可用性取决于现有后端配置。

## 测试与验证

- `apps/api/test/coach-status.spec.ts`：时区、RPE/疲劳区分、缺少依据及反馈时效。
- `apps/api/test/coach-center.e2e-spec.ts`：隔离 PostgreSQL、鉴权/归属、阶段失效、稳定活动引用、待处理恢复、终态历史截断、幂等放弃、草稿版本冲突和只读问答。
- `apps/mobile/src/features/coach/__tests__/coach-center.test.tsx`：真实数据展示、错误重试、任务轮询、按 ID 恢复、放弃确认、问答重试和追问、训练/饮食校验后确认、冲突刷新。

已执行：移动端全量 Jest 29组/262项通过；API 常规 Jest 24组/132项通过，11组/67项因未启用测试数据库跳过；另以本地隔离测试数据库执行 `coach-center`、`coach`、`nutrition` 三组集成测试，16项通过。集成测试模型为 stub，不代表真实模型或真机端到端验证。

实际执行命令：根目录 `pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过，lint 无警告；分别在 `apps/mobile` 与 `apps/api` 执行 `./node_modules/.bin/jest --runInBand`，结果如上。隔离集成通过临时包装脚本 `node /tmp/ridepilot-coach-center-integration.cjs` 执行：脚本只读取 `.env.test`，校验 PostgreSQL 为本机 `*_test`、Redis 为本机 DB1 后，注入测试环境并执行 Jest 的三个指定集成文件。凭证不写入仓库或日志。

完整数据库回归可按仓库已有 `pnpm --filter @ridepilot/api test:integration` 流程重现；本次仅单独执行上述三个集成文件，没有宣称所有被跳过的数据库用例都已验证。无需执行新增数据库迁移。

## 后续边界

跨设备问答历史、流式回答、聊天直接触发结构化草稿、完整历史分页/恢复入口和生成任务取消尚未接入；已有结构化任务入口继续提供生成能力。页面状态提示、问答和草稿均不会自动修改正式安排。

## 2026-11-05：问答空正文修复

已使用合成训练上下文、相同 Skill 与问题复现真实 DeepSeek 响应：原请求 `max_tokens=600` 返回 HTTP200、`finish_reason=length`、正文长度0，600个输出 tokens 全部计为 reasoning tokens。此前把该响应当作普通无效响应，`AiException` 没有转译为 HTTP 业务错误，页面只看到通用服务异常。

问答改为 `maxTokens=1600`、`thinkingMode=disabled` 并要求简短中文回答。Provider 仅针对原生 `api.deepseek.com` 转译为官方 `thinking:{type:"disabled"}` 参数；其他兼容端点不携带此厂商扩展，已有草稿生成请求保持原有参数。

Provider 检测到 `finish_reason=length` 返回可重试的 `AI_PROVIDER_OUTPUT_TRUNCATED`，即使已有部分正文也不作为完整答案；空白正文仍判无效。只返回最终 `content`，不会拿 `reasoning_content` 充当答案。

问答控制器通过专用异常过滤器返回中文错误与稳定 code：截断/空回答502、超时504、审核拒绝或待审核422、配置或审核服务故障503。客户端现有错误提示与保留输入逻辑可以直接显示并重试。没有自动重复调用模型，无数据库变更。

验证包含 Provider 的截断/空白/仅思考响应测试、原生 DeepSeek 参数与其他兼容端点隔离测试，以及问答真实 HTTP 错误映射/失败重试/无数据写入集成测试。额外真实模型联调只使用合成上下文，不读取或输出用户训练记录、API Key 或模型思考文本。本次执行 `./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`、`./node_modules/.bin/tsc -p apps/api/tsconfig.build.json` 和 `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src` 均通过。API 全量普通 Jest 24组137项通过，11组71项因数据库/真实模型条件未启用跳过；额外隔离数据库运行 coach-center、coach、nutrition 三组集成20项通过。Provider/AI 编排针对性测试2组18项通过。

真实模型以临时脚本 `node /tmp/ridepilot-coach-chat-live.cjs` 直接调用构建后的 `CoachChatService → AiService → AiOrchestratorService → OpenAiCompatibleProvider`，概览数据为合成输入，实际 Skill 与 Provider 使用当前代码；返回只读有效正文247字，模型调用约2.5秒。修复参数的独立请求检查也返回 `finish_reason=stop` 且没有 reasoning 字段。此验证不等于真机完整端到端验证。
