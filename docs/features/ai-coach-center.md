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

教练概览增加「训练执行与周期复盘」，统一查看执行记录、补录反馈、选择保留计划/生成后续训练/恢复/调整/安排测试，生成后经过预览、校验、确认应用并可进入下一周期训练。周期依据和应用版本可在复盘历史追溯；所有生成均由点击触发。详细统计口径、接口和边界见 [训练执行与周期复盘](training-cycle-review.md)。

## 2026-11-10：首页训练决策布局

本次仅重构移动端信息架构，继续使用既有鉴权、数据请求、草稿与正式计划流程；无 API、数据库或依赖变更。页面顺序调整为：

1. **当前阶段**：阶段名称、核心目标、简短身体状态及必要提醒。状态根据服务端 `status.code` 映射；缺少依据显示“恢复状态待评估”。阶段不存在时显示“阶段待规划”，不补造名称。点击状态进入新增的 `coach/status` 二级页查看完整解释、近七天证据、阶段起止日期。
2. **今日 / 下一次训练**：沿用概览返回的下一节未记录完成的正式课程 ID，与账号当地日期比较决定标题。使用已有课程详情接口补充时长与工作区段强度，不把测试混进训练卡。只合并相同课程和计划版本的数据；版本不一致时提示前往最新日历。详情失败保留概览摘要、详情重试及原有课程入口。暂无课程提供日历引导；无正式计划继续走首次建计划流程。
3. **AI 建议**：首页最多展示一条，复用 `pending` 数组。没有优先级字段，采用需调整的 `BLOCKED` 草稿优先，其次可预览草稿，最后生成任务；同类按创建时间倒序。原因来自既有摘要/失效说明，明确草稿未应用。生成中只读轮询保持不变。无建议隐藏整个模块，读取失败提供轻量重试，完整待处理与历史留在建议页。
4. **AI 快捷调整**：统一 2×2 紧凑宫格；重新规划 → 原 `REPLAN` 范围表单；调整本周 → 原本周生成及草稿预览；训练反馈 → 训练日历选择课程后进入既有反馈；比赛安排 → 原 `RACE` 备赛表单。缺资料时保留补全入口，操作中禁用重复点击。
5. **更多操作**：默认折叠，收纳赛后恢复、规划下周、训练执行与周期复盘、目标阶段/按范围生成课程、赛事管理/新增比赛、状态依据/阶段测试、计划版本、全部建议与历史。所有原能力均保留，测试安排/结果与版本列表迁至 `coach/status`。
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
