# AI 教练持续协作中心

## 目的与范围

落实 PRD 3.5.1、FR-802：已有正式计划的用户进入 AI 教练后，先了解当前阶段、状态依据及下一训练/测试，再选择问答或处理建议。保留首次建计划流程；没有正式计划时也可找回已生成的建议。

本次接入真实 API 和持久化草稿，进入页面、刷新和轮询均只读。生成、校验、应用由用户点击触发；自由问答不会创建或应用训练、饮食、阶段或测试。

## 操作路径

赛后恢复页面的最新布局、请求用途修复与验证记录见 [AI 教练 · 赛后恢复](ai-coach-recovery.md)。

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

| Method | Path                                | 行为                                                                                           |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/ai-coach/overview`                | 本人目标、阶段、状态依据、下一训练/测试、最多十四节未来未记录课程和最近版本                    |
| GET    | `/ai-coach/suggestions`             | 本人有效 pending 与 recent；失效草稿进入历史并显示原因，保留全部当前失效草稿及最近十条终态记录 |
| POST   | `/ai-coach/suggestions/:id/dismiss` | `{kind: TRAINING/NUTRITION/STAGE, expectedVersion}`，返回 `{dismissed:true}`                   |
| POST   | `/ai-coach/chat`                    | `{message, history?}`，只读答复；history 最多六条 user/assistant，禁止 system 角色             |

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

## 2026-11-05：建议生命周期补全

已接入失效建议历史投影、按输入复用生成、显式重新生成及成功替代、生成中上下文变化检查和应用后关联建议刷新。训练/补给被替代草稿使用 EXPIRED，列表显示 SUPERSEDED；阶段使用 SUPERSEDED。无新增迁移。当前规则及验证见 [建议生命周期与生成去重](coach-suggestion-lifecycle.md)。

## 周期复盘入口（2026-11-05）

原「训练执行与周期复盘」页面改为「训练历史」，入口移到“我的”页面；AI 教练的更多操作不再展示该入口。历史页仅按日期查看课程和进入只读详情，不保留复盘筛选、统计、建议或生成操作，详见 [训练历史](training-history.md)。已有周期草稿仍可在建议列表查看，返回操作前往训练历史。

## 2026-11-10：首页训练决策布局

本次仅重构移动端信息架构，继续使用既有鉴权、数据请求、草稿与正式计划流程；无 API、数据库或依赖变更。页面顺序调整为：

1. **当前阶段**：阶段名称、核心目标、简短身体状态及必要提醒。状态根据服务端 `status.code` 映射；缺少依据显示“恢复状态待评估”。阶段不存在时显示“阶段待规划”，不补造名称。点击状态进入新增的 `coach/status` 二级页查看完整解释、近七天证据、阶段起止日期。
2. **今日 / 下一次训练**：沿用概览返回的下一节未记录完成的正式课程 ID，与账号当地日期比较决定标题。使用已有课程详情接口补充时长与工作区段强度，不把测试混进训练卡。只合并相同课程和计划版本的数据；版本不一致时提示前往最新日历。详情失败保留概览摘要、详情重试及原有课程入口。暂无课程提供日历引导；无正式计划继续走首次建计划流程。
3. **AI 建议**：首页最多展示一条，复用 `pending` 数组。没有优先级字段，采用需调整的 `BLOCKED` 草稿优先，其次可预览草稿，最后生成任务；同类按创建时间倒序。原因来自既有摘要/失效说明，明确草稿未应用。生成中只读轮询保持不变。无建议隐藏整个模块，读取失败提供轻量重试，完整待处理与历史留在建议页。
4. **AI 快捷调整**：统一 2×2 紧凑宫格；重新规划 → 原 `REPLAN` 范围表单；调整本周 → 原本周生成及草稿预览；训练反馈 → 训练日历选择课程后进入既有反馈；比赛安排 → 原 `RACE` 备赛表单。缺资料时保留补全入口，操作中禁用重复点击。
5. **更多操作**：默认折叠，收纳赛后恢复、规划下周、目标阶段/按范围生成课程、赛事管理/新增比赛、状态依据/阶段测试、计划版本、全部建议与历史。所有原能力均保留，测试安排/结果与版本列表迁至 `coach/status`。
6. **问 AI 教练**：唯一入口固定在页面内容下方、原 Tab Bar 上方，使用普通可点击入口而非真正的文本输入。点击才进入既有聊天页，由聊天页处理输入与键盘；首页不会弹出键盘或触发模型请求。页脚占用正常布局空间，不覆盖滚动内容和导航安全区。

阶段信息需要核对时，课程卡明确提示“阶段待核对；课程仍为已发布的正式安排”，不将阶段失效等同于课程作废。所有调整继续经过草稿、预览、校验、确认和原有版本检查；首页读取不生成/应用计划。

### 组件与路由

- `CoachScreen`：装配首页、任务和原有首次计划流程。
- `CoachOverviewPanel`：沿用概览读取与错误重试，组合 `CoachContextCard`、`CoachNextWorkoutCard`。
- `CoachSuggestionSpotlight`、`CoachSuggestionsPanel`：首页精选与完整建议列表共用已有资源轮询和导航。
- `CoachHome`、`CoachMoreActions`、`CoachChatEntry`：核心任务、低频操作与唯一聊天入口。
- `CoachStatusScreen` / `app/(tabs)/coach/status.tsx`：完整依据、测试安排/结果、近期版本。
- `model/coach-home.ts`：建议排序、状态摘要和工作区段强度映射。混合 W 与 %FTP 不合并成一个数值。

### 本次验证

- `pnpm --filter @ridepilot/mobile test`：36 组、325 项全部通过。包括原有建计划、预览/确认、冲突处理、建议轮询与放弃流程，以及新增首页排序、单条建议、无建议隐藏、快捷操作、更多入口、状态二级页、课程详情降级与版本变化测试。
- `pnpm typecheck`、`pnpm lint`、`pnpm build`：全部通过。
- `pnpm test`：API 常规测试 29 组、164 项通过；15 组、125 项因数据库/外部服务条件未启用而跳过，本任务未声称完成这些集成测试。
- `pnpm exec prettier --check apps/mobile/src/features/coach 'apps/mobile/app/(tabs)/coach/status.tsx' docs/features/ai-coach-center.md`、`git diff --check`：通过。
- `pnpm --filter @ridepilot/mobile exec expo export --platform web --output-dir /tmp/ridepilot-coach-web --max-workers 2`：实际移动端 Web 导出成功（3828 模块）。开发服务曾遇到本机 `EMFILE` 文件监听上限，改用不依赖监听的导出进行验证。
- `node /tmp/ridepilot-coach-browser.cjs`：通过导出后的真实 React Native Web 页面验证；浏览器拦截 API 返回合成数据，不连接真实账号。检查 320/390/430 宽度、单条建议、唯一提问入口在 Tab Bar 上方、状态依据路由、无建议隐藏、概览失败仍可操作、无正式计划引导、浏览首页不生成/应用，以及无页面脚本异常。临时验证脚本和截图位于 `/tmp`。
- `node /tmp/ridepilot-coach-design-check.cjs`：独立设计稿 320/390/430 宽度、四格操作、单条建议、更多展开和聊天/Tab 间隔检查通过。

已同步 `RidePilot_UI/design/screens/A01-ai-coach.html`、交接 Markdown、设计决策及五栏联动原型。设计预览与浏览器截图不等同于 iOS/Android 真机安全区、动态字体和键盘验证；本任务未执行真机或真实模型端到端联调。

### 快捷卡片底部留白修正

快捷卡片最小高度由 104 调整为 76，保留上下 12 内边距和标题/说明间距 8，消除短文案下方的额外留白。同一行卡片仍等高；小屏或大字体换行时按内容增高，不截断说明。业务操作与禁用状态沿用原逻辑。

本次执行 `pnpm --filter @ridepilot/mobile test -- --runTestsByPath src/features/coach/__tests__/coach-center.test.tsx`，19 项通过；移动端 `typecheck`、`lint` 和两个仓库的 `git diff --check` 通过。设计预览同步最小高度；未重复执行真机或完整 Web 导出验证。

### 首页统一加载状态

`CoachScreen` 通过 `useCoachDashboard` 协调资料、概览、下一节课程详情和待处理建议的初次读取。首次进入、返回首页重新读取以及失败后的手动重试，只显示同一个页面级 Loading；所有请求完成或失败后再展示模块，避免多个卡片各自显示 Loading。无正式计划时只读取建议，不请求训练概览或详情。

首页使用 `CoachOverviewContent`、`CoachNextWorkoutContent` 和 `CoachSuggestionSummary` 展示已读取的数据，避免子组件重复请求。独立面板及二级页面继续沿用自己的加载状态。概览和建议失败保留各自重试；课程详情失败保留正式课程摘要与重试入口。建议生成任务的后台轮询不会隐藏已显示内容或触发整页 Loading。API、草稿预览、确认应用和路由逻辑保持不变。

新增 `coach-home-loading.test.tsx` 覆盖串联请求期间的单一 Loading、部分失败与独立重试、概览错误恢复、后台轮询和无计划引导。

本次实际执行：

- `pnpm --filter @ridepilot/mobile test -- --runTestsByPath src/features/coach/__tests__/coach-home-loading.test.tsx src/features/coach/__tests__/initial-plan-flow.test.tsx src/features/coach/__tests__/coach-center.test.tsx`：3 组、47 项通过（新增 5 项）。
- `pnpm --filter @ridepilot/mobile typecheck`、`pnpm --filter @ridepilot/mobile lint`：通过。
- 已对本次代码和文档执行 Prettier 格式化，`git diff --check` 通过。

本次未执行真机验证或重新导出 Web。

## 2026-11-10：首页排版、训练卡片与提示文案优化

本节取代前述首页底部固定提问栏的布局说明。按 `RidePilot_UI/AGENTS.md` 的 2.2、2.3 节校准字号与密度，继续使用既有黑金暗色 Token。

- 页面标题 32，分区标题 20，课程、阶段和快捷卡片标题 17，目标说明、建议摘要与操作文字 16，日期、指标标签和状态等辅助信息 12–13；训练关键数字 32，并使用等宽数字。复用 `AppText` 变体，未修改全局字号。
- 首页顺序为当前阶段、今日/下一次训练、单条待处理建议、四格快捷调整及折叠的更多操作。区块间距 24，卡片圆角 18、内边距 16–20；阶段摘要改为轻量分隔区域，减少整页卡片的同等视觉权重。建议摘要和目标文本自然换行。
- 训练卡片将日期、课程名称、计划时长/目标距离、工作段强度、正式计划状态和查看操作分组。无时长但有距离时只显示距离，不折算时长；无强度信息不生成假数值。查看课程使用次级按钮。详情失败仍可重试，版本变化时不再显示“已生效”图标及状态，而是提示刷新并进入日历。
- 「问 AI 教练」迁至页面右上角的消息图标，触控区域 44×44，保留无障碍名称与提示；有计划和首次建计划首页均显示唯一入口。点击仅跳转现有对话页。右上角没有训练日历按钮，底部不再显示提问栏。
- 删除顶部口号、快捷区重复的预览确认说明、训练卡片静态“公路骑行”、未来课程下方重复的今日无训练提示，以及与阶段区域重复的核对提示。状态依据入口用状态文字与箭头表达。首次引导去掉重复的未建计划标签、无依据的预计用时和底层存储说明。草稿未应用、资料缺失、阶段失效、版本变化和读取失败等影响判断的提示仍保留。

没有 API、契约、数据库或迁移变更；原有加载、轮询、预览、校验、确认应用及权限校验流程沿用。

验证覆盖：`coach-center.test.tsx` 的训练指标、距离目标、缺失强度、版本冲突及导航；`coach-home-loading.test.tsx` 的唯一图标入口、跳转、无计划入口和原有加载/错误恢复；首次建计划流程回归。

本次实际执行：

- `pnpm --filter @ridepilot/mobile typecheck`、`pnpm --filter @ridepilot/mobile lint`：通过。
- `pnpm --filter @ridepilot/mobile test -- --runTestsByPath src/features/coach/__tests__/coach-center.test.tsx src/features/coach/__tests__/coach-home-loading.test.tsx src/features/coach/__tests__/initial-plan-flow.test.tsx`：3 组、48 项通过。
- `pnpm --filter @ridepilot/mobile exec expo export --platform web --output-dir /tmp/ridepilot-coach-layout-web --max-workers 2`：导出成功，3832 个模块。
- `node /tmp/ridepilot-coach-layout-browser.cjs`：用合成 API 数据检查 320/390/430 宽度、实际计算字号、首页区块顺序、唯一右上角聊天图标及 44×44 触控区、快捷任务/聊天/状态路由、空建议隐藏、概览失败和无计划引导；未触发生成/应用请求，无页面脚本错误。截图保存在 `/tmp/ridepilot-coach-layout-*.png`。

本任务不涉及后端变更；未执行 iOS/Android 真机、系统大字体或真实模型端到端验证。

## 2026-11-12：聊天布局与持久化历史

「问 AI 教练」更新为左右气泡、固定输入栏与键盘避让，按账号持久化连续对话并支持历史分页、处理中恢复和失败同消息重试。此前关于“问答仅保存在当前页面”和“历史尚未接入”的说明由本次实现取代。原无状态问答接口保留兼容，移动端切换到持久化接口；仍为只读训练建议。迁移、接口及验证见 [聊天布局与历史记录](coach-chat-history.md)。

## 2026-11-12：更多操作去重

按用户要求核对全部入口，更多操作只保留「赛后恢复」和「全部建议与历史」。移除项与保留的访问路径如下：

| 移除的重复入口           | 可继续使用的入口                                                          |
| ------------------------ | ------------------------------------------------------------------------- |
| 规划下周                 | AI 快捷调整 → 重新规划 → 从下周开始；也可在目标详情按日期范围规划下周课程 |
| 目标阶段与按范围生成课程 | 当前阶段卡片 → 目标详情，或我的 → 目标                                    |
| 赛事管理与新增比赛       | 我的 → 我的赛事，或训练页赛事管理入口                                     |
| 最近计划版本             | 首页状态文字 → 状态依据页 → 近期计划版本                                  |

赛后恢复保留独立引导，可以不先登记具体赛事；已完成的赛事也有专属恢复入口，两者上下文不同。全部建议入口虽然在有待处理建议时会出现在建议区，但无待处理建议时整个建议区隐藏，因此菜单中的历史入口仍需保留。

本次仅修改移动端入口、对应测试及设计/功能文档，没有 API 或数据库变更。菜单仍默认折叠，操作中禁用。已同步设计页面、五栏原型、交接 Markdown 和设计决策。

实际验证：

- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/coach-center.test.tsx src/features/coach/__tests__/coach-home-loading.test.tsx src/features/coach/__tests__/initial-plan-flow.test.tsx src/features/coach/__tests__/adjustment-scope.test.ts src/features/integrations/__tests__/third-party-apps.test.tsx`：5 组、65 项通过。覆盖菜单移除重复入口、折叠及禁用、无待处理时仍可访问历史、重新规划选择下周范围，以及个人页的目标/赛事导航。
- 在 `apps/mobile` 执行 `./node_modules/.bin/tsc --noEmit` 与针对 `CoachMoreActions.tsx`、`CoachScreen.tsx` 和本次三个测试文件的 ESLint：通过。
- 本次修改文件 Prettier 检查、主仓库与设计仓库的 `git diff --check`：通过。

本次没有运行真机或真实模型验证；没有改动生成和应用服务。

## 2026-11-12：常驻入口与首页重设计

本节取代上述「更多操作默认折叠」的布局说明。将「赛后恢复」「全部建议与历史」移出菜单，放为快捷调整下方的两条常驻整行入口；没有待处理建议或概览读取失败时仍可访问。操作忙碌时禁用，赛后恢复点击后进入既有引导，不提前生成或应用。这里的历史指结构化建议记录，聊天历史仍从右上角消息图标进入。

首页从上到下为当前阶段与状态、今日／下一次训练、单条待处理建议、四格快捷调整、两个常驻入口：

- `CoachDashboardPage` 独立负责已有计划首页的标题、滚动和错误展示；首次建计划及各引导页保留原布局。
- 阶段取消外层卡片，以 24 号标题和目标说明突出当前进度；状态依据作为独立的轻量条目，触控至少 44。
- 训练卡保留真实课程、日期、时长／距离、工作段强度及正式版本状态，以 20 号课程标题、32 号关键数字、分列指标和底部文字链接建立层级。缺失强度、详情失败、版本变化及重试继续沿用原有处理。
- 有待处理建议时，分区标题旁只显示数量，完整历史统一从下方入口进入；无建议仍隐藏摘要区。
- 快捷调整保持重新规划、调整本周、训练反馈、比赛安排四项，2×2 卡片最小高度 92、内边距 16，文案在小屏自然换行。`CoachSupportActions` 展示两条最小高度 80 的常驻入口，移除 `CoachMoreActions`。
- 使用黑金 Token、左右留白 20、区块间距 24；保留右上角唯一聊天入口与原五栏导航。未新增依赖，未修改 API、数据库或迁移；草稿、预览、校验和确认应用流程沿用。

新增首页回归覆盖有／无待处理建议时的唯一历史入口、直接进入恢复引导、概览失败仍保留入口，以及原有加载、轮询与错误恢复。设计资产同步 A01 HTML、五栏联动原型、交接 Markdown 和设计决策。

本次实际执行（移动端命令工作目录均为 `apps/mobile`）：

- `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/coach-center.test.tsx src/features/coach/__tests__/coach-home-loading.test.tsx src/features/coach/__tests__/initial-plan-flow.test.tsx src/features/coach/__tests__/coach-home.test.ts src/features/coach/__tests__/coach-chat.test.tsx`：5 组、60 项通过。
- `./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint src/features/coach`：通过。
- `./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-coach-redesign-web --max-workers 2`：成功导出，3863 个模块。
- `node /tmp/ridepilot-coach-redesign-browser.cjs`：合成 API 验证 320／390／430 宽度、首页区块顺序、唯一历史和聊天入口、聊天触控区域、恢复与历史导航、空建议／缺阶段及课程／概览错误；未触发生成或应用等业务写请求，无页面脚本错误。截图 `/tmp/ridepilot-coach-redesign-*.png`。
- `node /tmp/ridepilot-coach-redesign-design-check.cjs`：设计稿 320／390／430 宽度、常驻入口、四格布局、底栏避让及五栏导航通过。
- 本次修改文件的 Prettier 检查、主仓库与设计仓库的 `git diff --check`：通过。

浏览器验证使用合成数据。本次未执行 iOS／Android 真机、系统大字体或真实模型端到端验证。

## 2026-11-12：训练调整与赛事备赛分流

本节取代此前四格快捷操作与通用比赛表单说明。用户希望移除只跳转训练日历的反馈入口，并区分重新规划和比赛安排，按专业 UI/UX 重新整理层级。

- 移除「训练反馈」，原课程反馈继续从训练详情进入。「重新规划」更名为「调整训练」，与「调整本周」组成两列卡片；图标、标题与说明纵向排列，最小高度 132、内边距 16，继续使用黑金 Token 和 24 的区块间距。「调整本周」沿用快捷生成本周草稿，说明明确提示该行为。
- 常驻列表改为「赛事备赛」「赛后恢复」「全部建议与历史」，使用统一的右向箭头表达导航。聊天入口、阶段与正式课程摘要保留。
- 新增 `ReplanBrief`，训练调整页聚焦三个真实支持的范围（下一节、本周剩余、下周）、选填说明、当前目标及修改入口。去掉重复标题卡、重复说明、不可用的整个周期选项与底部重复返回按钮；生成仍进入草稿预览、校验及确认应用。
- 新增 `coach/races` 赛事选择页，读取已确认且比赛日期不早于赛事所在时区今天的赛事，按日期、同日优先级排序；使用日期块、名称、距离与比赛目标组织列表。无赛事提供添加入口，读取失败重试，未登录不请求；已完成、取消或过去赛事仍可在全部赛事查看。
- 选择赛事携带 `raceId`、`phase=PREPARATION` 进入已有 `races/proposal`。计划页补充赛事摘要，明确当前比赛名称、日期、距离与目标，再使用原日期范围、影响预览、版本校验、幂等生成和确认应用流程。移除教练 `RACE` 通用任务，避免仅把比赛文本混进普通训练备注；不新增 API 或数据库迁移。
- 拆分 `useCoachRaces`、`CoachRaceCard`、`CoachRacePreparationScreen`、`RaceTrainingContext`，沿用既有 API、鉴权与草稿服务；不在前端直接更新正式计划。首次建计划和独立赛后恢复路径沿用。

设计同步：A01 首页、A03 训练调整、A04 赛事选择、五栏联动原型、交接 Markdown 与设计决策。A03 的范围选择与输入可交互，其余深层操作链接至交接说明；设计稿使用合成示例，业务以 App 为准。

本次实际验证（移动端命令工作目录为 `apps/mobile`）：

- `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/coach-center.test.tsx src/features/coach/__tests__/coach-home-loading.test.tsx src/features/coach/__tests__/initial-plan-flow.test.tsx src/features/coach/__tests__/coach-planning-entry.test.tsx src/features/races/__tests__/race-proposal.test.tsx src/features/races/__tests__/race-training-setup-routes.test.tsx src/features/coach/__tests__/adjustment-scope.test.ts`：7 组、95 项通过。之后修正新范围单选的原生／Web 读屏状态，重跑 `initial-plan-flow.test.tsx` 23 项及 `coach-planning-entry.test.tsx` 6 项通过；变更单选的最终复测 6 项通过。
- `./node_modules/.bin/tsc --noEmit`：通过；`./node_modules/.bin/eslint src/features/coach src/features/races/hooks/useRaceTrainingDraft.ts src/features/races/screens/RaceProposalScreen.tsx src/features/races/components/RaceTrainingContext.tsx src/features/races/__tests__/race-proposal.test.tsx 'app/(tabs)/coach/races.tsx'`：通过。单选最终修改后额外检查其组件及测试的 ESLint 通过。
- `./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-coach-workflows-web --max-workers 2`：最终导出成功，3869 个模块。
- `node /tmp/ridepilot-coach-workflows-design-check.cjs`：设计首页、训练调整及赛事选择在 320／390／430 宽度无横向溢出；两列训练操作、三条常驻入口、底栏避让、范围切换与五栏导航检查通过。
- 本次修改文件 Prettier 检查、主仓库及设计仓库 `git diff --check`：通过。
- `node /tmp/ridepilot-coach-workflows-browser.cjs`：以合成 API 验证实际 Web 导出在 320／390／430 宽度的首页、训练调整和赛事选择；覆盖两个训练操作、移除入口、区块顺序、单选切换与 Web 读屏状态、输入、赛事导航及赛事摘要、无赛事添加、失败重试、首页无建议／缺数据／概览失败。未触发业务写请求，无页面脚本错误；截图 `/tmp/ridepilot-coach-workflows-*.png`。

本次没有后端或数据库改动；未执行 iOS／Android 真机、系统大字体或真实模型联调。浏览器结果不能替代这些验证。

### 顶部阶段外链的过渡页面修复

用户反馈从教练首页点击当前阶段时，会先出现训练调整页，再进入正确的目标与阶段页面。`CoachScreen` 使用全局 `usePathname` 识别展示步骤；打开教练外部路由后，仍挂载在下层的教练页读到目标页路径，原逻辑回退到共享流程的上次步骤（例如 planning），从而在页面切换时闪出旧任务。

现改为保留最后一个匹配的教练路由展示步骤，外部路径不再使用任务状态切换下层页面。阶段入口继续直接携带目标 ID 进入目标与阶段，不新增中间跳转，也不清空原任务输入。新增回归覆盖：流程残留在 planning 时，首页点击阶段只导航一次，外部路径切换和返回后仍保持首页，不渲染训练调整表单。

修复实际验证：

- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/coach-home-loading.test.tsx src/features/coach/__tests__/initial-plan-flow.test.tsx src/features/coach/__tests__/coach-planning-entry.test.tsx`：3 组、37 项通过。
- `./node_modules/.bin/tsc --noEmit`、针对 `CoachScreen.tsx` 与 `coach-home-loading.test.tsx` 的 ESLint、Prettier 检查和 `git diff --check`：通过。
- Web 重新导出成功；`node /tmp/ridepilot-coach-goal-navigation-browser.cjs`：保留同一页面提供器，先打开训练调整、通过浏览器返回保留旧任务、点击顶部阶段，再返回首页；目标路由切换期间用 DOM 观察器确认未出现调整表单。并复测原 320／390／430 布局、训练与赛事路径及空／错误状态；无脚本错误或业务写请求。

验证使用合成 API，未执行原生页面切换动画的真机测试。
