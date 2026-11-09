# PRD 与当前代码逻辑缺口复核（2026-11-09）

基线：开发仓库 `dfd6285`；[RidePilot_Product/PRD.md](../../RidePilot_Product/PRD.md)，文档自标 V2.0，含后续补充条款。检查移动端入口、API、共享契约、数据库模型及现有测试。本次只新增审查报告，没有修改业务代码、数据库或产品文档。

结论：基础训练闭环已具备，仍未达到 PRD 全部 P0 验收要求。主要缺口是安全规则、反馈事实的完整性、App 端恢复及编辑能力、跨领域确认和首页/日历聚合。不能将“存在后端接口”或“现有测试通过”视作产品闭环完成。

以下“先修 / 随后补齐 / 统一口径”是建议开发顺序，不重新定义 PRD 的 P0/P1。

## 1. 已具备，不应重复列成缺失

- 注册登录、基础档案、FTP 门槛、功率/心率设置。
- 无正式计划时的引导、手动课程、AI 草稿、校验、预览、确认及正式版本。
- 独立阶段规划、手动测试安排、测试结果与比较、复评后生成后续范围课程。
- 目标独立创建、暂停/恢复、延期、完成/结束、下一目标、主次切换与阶段复评记录。
- FTP、目标、可用时间变化后的影响检查、明确保留、FTP 重算或范围重排。
- 赛事增改取消、结果、跨周备赛和赛后恢复草稿。
- 营养档案、餐食替换、份量/时间编辑、训练补给联动和独立确认。
- 教练状态依据、自由问答、待处理建议恢复/放弃、训练执行与周期复盘。

上述均有当前代码依据；本次未重新证明数据库、真实模型和真机端到端全部通过。此前报告中“没有目标生命周期”“没有 FTP 变更处理”“赛事只能调整比赛周”“营养份量无法编辑”等说法不再适用于当前版本。

## 2. 缺口总表

| 编号 | 建议顺序             | PRD 对应                        | 当前缺口 / 未闭环逻辑                                                                                                                            |
| ---- | -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| G01  | 先修，上线阻塞       | FR-804/805；§12.1               | 实际输入/输出审核只有始终 ALLOW 的 Noop；production 唯一可选审核模式又被配置禁止，无法正常启动。                                                 |
| G02  | 先修，已复现规则缺口 | M06 业务规则、AC-M06；§7.2      | 营养规则未落实具体禁忌；成分 PARTIAL 未阻断；过敏判断依赖候选自己声明标签，漏标缺乏独立核验。                                                    |
| G03  | 先修，影响后续决策   | FR-702～704；§3.5.5             | 训练反馈只能新增，不能更正；实际日期绑定计划日期；记录接口未校验未来日期。缺结构化睡眠/恢复、疼痛/异常和可选距离/功率/心率。                     |
| G04  | 随后补齐             | FR-309/905；E2E-14              | 后端有历史版本/恢复草稿，App 仅展示摘要，缺版本详情比较、恢复预览和确认入口。                                                                    |
| G05  | 随后补齐             | FR-007/302/313；§6.2；E2E-03    | 课程动作排序图标没有排序行为；缺简洁/专业切换与偏好持久化；手动编辑器未接实时课程结构图。                                                        |
| G06  | 随后补齐             | FR-305～307/902；§6.3           | AI 候选局部编辑 API 未接 App；普通/单节预览缺完整参数差异；单节页未提供“本节或后续联动”的范围选择和对应确认。                                    |
| G07  | 随后补齐             | §3.5.2/3.5.5；FR-704            | 周期复盘有执行证据，但普通周调整/单节调整未统一读取近期反馈及恢复趋势，容易产生不同入口依据不一致。                                              |
| G08  | 统一口径后实施       | FR-603～606/902/904；AC-M07/M10 | 当前训练、测试、阶段、营养分别处理；未达到 PRD 勾选营养一起应用和关联变更统一预览的口径。赛事冲突仍需用户手动处理测试和优先级取舍。              |
| G09  | 随后补齐             | FR-202/204；P04                 | 日历只有周视图；缺显式休息/恢复事件、课程改期与冲突替代日期流程。空白日不能可靠区分休息与尚未规划。                                              |
| G10  | 随后补齐             | P03；§6.1；M11                  | 首页只聚合档案、训练、营养，身体状态固定待评估；下一测试/比赛、目标差距、待确认建议未聚合。跨周期趋势仍不完整。                                  |
| G11  | 随后补齐             | FR-002～004/007；§12.4          | 训练目的、设备条件等有部分 DB 预留但未开放档案闭环；可用时间仅星期/分钟数，缺具体/弹性时段；时区设置和跨时区处理不完整。                         |
| G12  | 随后补齐             | §3.5.2；§12.2                   | “整个周期”快捷调整仍直接报未开放；离开生成页只停止客户端等待，缺持久化取消任务及取消后状态处理。                                                 |
| G13  | 上线前补齐           | P14；§12.1                      | 数据导出/删除仍为未开放文案，缺 AI/敏感数据授权记录、授权版本及用户可操作的数据处理路径。                                                        |
| G14  | 上线前补齐           | FR-806；§12.1/12.5              | 已有鉴权限流、生成去重/重试、用量日志，但仓库内未见 AI/应用接口限流、完整告警及统一业务审计/埋点闭环。                                           |
| G15  | 后续细化             | FR-101/102/106；M11             | FTP 目标有差距/期限/可用时间事实评价；非 FTP 目标主要靠文字达成条件，缺结构化基线/指标。难度仍为事实加通用说明，多目标资源冲突没有具体分析方案。 |

## 3. 重要发现与代码依据

### G01：真实 AI 审核未实现，production 配置不可用

[审核适配器](../../apps/api/src/ai/guardrails/noop-guard.adapter.ts) 第 14 行始终返回 ALLOW。[装配](../../apps/api/src/ai/ai.module.ts) 只注册 Noop，且 production 会抛错。[环境校验](../../apps/api/src/config/env.ts) 第 28 行只允许 `AI_GUARD_MODE=noop`，第 74～79 行又禁止 production 使用 noop，因此没有可用的生产审核配置值。

已有 JSON、功率/日期/时长、结构化症状等校验，以及审核失败的编排分支，不等于具备实际语义审核。应补真实适配器、故障策略及风险用例，再验证 production 启动；不能用移除生产保护来算完成。

### G02：禁忌与不完整成分没有形成可靠阻断

[营养校验](../../apps/api/src/modules/nutrition/nutrition.validation.ts) 第 17～43 行只比较 `allergenTags`、阻断 UNKNOWN、检查 OTHER 是否有说明。`NO_PORK`、`NO_BEEF` 等限制没有具体内容校验，`dietStyle` 也未参与该规则。`PARTIAL` 不触发成分不足阻断。食物名称与标签是否一致没有独立依据核验。

本次从当前 TS 源码转译并直接调用 `validateNutritionDraft`，输入先用现有 Zod 契约解析。档案声明花生过敏及 NO_PORK，实际结果如下：

| 合法结构的候选食物              | blockers       | 结果             |
| ------------------------------- | -------------- | ---------------- |
| 猪肉，KNOWN，空过敏标签         | 空             | 禁忌未阻断       |
| 复合食品，PARTIAL，空过敏标签   | 空             | 成分不完整未阻断 |
| 花生酱，KNOWN，模型漏标 PEANUT  | 空             | 规则信任候选标签 |
| 花生酱，KNOWN，明确 PEANUT 标签 | 含 PEANUT 冲突 | 对照正确阻断     |

前三项仅出现一般性的“营养数值为估算”提醒，没有对应禁忌或成分风险阻断。[正式应用](../../apps/api/src/modules/nutrition/nutrition-application.service.ts) 第 134 行再次调用同一校验，未提供独立补救。现有生成提示词有约束，但不能替代确定性安全校验。

这是校验函数级复现，没有将这些食物写入数据库，也不声称已经完成 API 应用复现。应增加可信食材/成分依据、禁忌约束和不完整来源的保守处理，不能简单相信模型填的 KNOWN/标签。

### G03：反馈填错无法修正，计划日期与实际执行混用

[反馈 hook](../../apps/mobile/src/features/training/hooks/useWorkoutFeedback.ts) 第 20～23 行在已有记录时退出，并将 `localDate` 固定为 `workout.scheduledDate`；[反馈页面](../../apps/mobile/src/features/training/screens/WorkoutFeedbackScreen.tsx) 第 55 行仅提示已经记录。[记录服务](../../apps/api/src/modules/coach/coach-events.service.ts) 第 36～48 行要求记录日期等于计划日期，已有记录则返回 `ACTIVITY_ALREADY_RECORDED`。

因此提前做、隔天补做没有真实日期表达；误填疲劳或完成情况后也无法更正。该写入分支只核对计划日期，未与账号当地今天比较，静态可见未来课程也未被日期规则阻断。未来记录风险本次未做数据库复现。

[反馈契约](../../packages/contracts/src/coach.ts) 第 63～74 行只有状态、时长、RPE、疲劳、备注。建议补实际日期、结构化反馈、记录版本与更正历史；保存/更正后刷新状态和复盘，并使依赖旧证据的草稿失效，不能自动改正式训练。

### G04：恢复能力停在后端

[恢复 controller](../../apps/api/src/modules/coach/plan-restore.controller.ts) 已提供版本列表、详情、恢复提案；[恢复 service](../../apps/api/src/modules/coach/plan-restore.service.ts) 有新版本恢复逻辑。App 的[版本区域](../../apps/mobile/src/features/coach/components/CoachOverviewPanel.tsx) 第 160 行起只渲染文本，没有详情和恢复按钮；移动端服务未接 `plans/versions` 和 `restore-proposal`。

[建议列表类型](../../apps/api/src/modules/coach/coach-suggestions.repository.ts) 还未包含 PLAN_RESTORE，不能认为恢复草稿会自然出现在普通待处理列表。需要做 App 完整入口，并验收 v3 → v4 → 恢复 v3 的未来内容 → v5，保留实际记录和冲突/幂等保护。

### G05 / G06：编辑及预览尚未达到可审阅程度

- [动作列表](../../apps/mobile/src/features/training/components/WorkoutSegmentList.tsx) 的参数只有新增/编辑/删除；第 50 行 GripVertical 是装饰，没有排序回调。
- [手动编辑器](../../apps/mobile/src/features/training/components/Editor.tsx) 有汇总和动作表单，没有视图切换和实时结构图。详情已有图表，不应误报为整个项目没有课程可视化。
- [候选编辑 API](../../apps/api/src/modules/coach/ai-proposal.controller.ts) 已有 PATCH，但移动端未接；“继续修改”返回调整条件，不是编辑生成后的动作。
- [单节预览](../../apps/mobile/src/features/training/components/WorkoutAdjustmentPreview.tsx) 第 34～54 行主要比较标题、日期、动作数和新目的，没有时间/强度/距离逐项差异，也没有后续联动范围选择。
- [通用预览](../../apps/mobile/src/features/coach/components/PlanPreview.tsx) 能列出新课程详情；资料变更场景已额外展示完整旧课程，不能再一概说“所有预览都没有旧数据”。其他普通调整仍缺通用旧新对照及营养影响说明。

验收应覆盖：候选局部改完重新校验；排序改变真实结构；双视图共享草稿；90 分钟阈值改 45 分钟恢复骑时，清楚显示时间、强度、目的和影响范围。

### G07：普通调整没有统一接入近期执行证据

[生成上下文](../../apps/api/src/modules/coach/coach-generation-context.service.ts) 第 186 行起加载 FTP、目标、时间、档案、计划、赛事和测试；记录查询主要用于保护已有反馈课程，PLAN_ADJUST 的 `relatedId` 分支只额外加载一条活动。周期复盘、阶段复评和测试复评有独立证据分支，但普通 WORKOUT_ADJUST / PLAN_ADJUST 没有统一近期完成量、疲劳/恢复摘要。

建议抽取统一事实摘要供不同生成入口复用，并保留来源、时间、缺失状态和指纹校验。不能把“某个入口读取了证据”推导成所有入口都已具备自适应依据。

### G08：当前分别确认与 PRD 一起应用存在口径差异

[营养应用](../../apps/api/src/modules/nutrition/nutrition-application.service.ts) 要求关联训练先应用，再基于当前正式训练生成/校验补给。[功能文档](../features/nutrition.md) 明确没有跨领域统一原子变更集。现有串行联动是真实能力，不应描述成没有营养联动，但仍不符合 PRD M10 应用规则第 4 条的“一起应用”。

[赛事影响服务](../../apps/api/src/modules/coach/race-impact.service.ts) 已查跨日范围内课程、测试、相近赛事、阶段；第 144～159 行明确让用户自行调整测试、单独确认阶段/补给。当前有优先级提醒，尚缺具体的赛事取舍方案和可执行测试顺延/替代建议。

若 V1 接受分别确认，应先更新 PRD 和验收口径；若保留统一应用，则需要统一变更集、完整差异、全体版本检查和事务。已确认的“阶段/测试分别主动操作”边界应保留，不能擅自做自动晋级或自动改期。

### G09 / G10：日历与首页未汇总已有能力

[日历页面](../../apps/mobile/src/features/training/screens/TrainingScreen.tsx) 固定生成 7 天，已有课程、测试和比赛投影；缺月历、休息事件，以及课程改期的专门交互、冲突解释和替代日期。

[首页服务](../../apps/api/src/modules/home/home.service.ts) 只返回 profile、training、nutrition；[身体状态卡](../../apps/mobile/src/features/home/components/HomeStatusCard.tsx) 没有数据参数，始终写待评估。教练中心已有的状态依据/待处理建议没有聚合回首页，下一测试/比赛及目标差距也缺入口。

[周期复盘](../../apps/api/src/modules/coach/cycle-review/cycle-review.policy.ts) 已有完成情况、时长、RPE/疲劳和最近两次 FTP，不能列为“完全没有分析”。M11 剩余重点是更完整的指标历史、跨周期趋势和统一来源展示。长期完成率还需明确历史计划分母：当前不会追溯被替换且无反馈的旧课程，详见[统计边界](../features/training-cycle-review.md)。

### G11：档案/时区存在数据预留与实际产品能力脱节

[Prisma 模型](../../apps/api/prisma/schema.prisma) 有 trainingPurpose、equipmentFlags、viewPreference；[档案契约](../../packages/contracts/src/profile.ts) 没有开放这些字段，也不允许修改 timezone/locale。[可用时间契约](../../packages/contracts/src/coach.ts) 只包含星期、可用分钟数、单次上限，没有具体/弹性时段。

账号[注册写入](../../apps/api/src/modules/auth/auth.repository.ts) 未传时区，User 默认 UTC；训练日历的[今天计算](../../apps/mobile/src/features/training/screens/TrainingScreen.tsx) 第 37 行调用[设备本地日期](../../apps/mobile/src/features/training/model/training.ts)，首页及服务端编辑限制则按账号时区。可用时间中虽另存 timezone，也未形成账号时区变更和“保留当地日期/绝对时间”的确认流程。设备与账号时区不同、午夜附近可能出现今天定义不同；本次为静态发现，未做跨时区真机复现。

### G12：周期入口和生成取消

[范围解析](../../apps/mobile/src/features/coach/services/adjustment-scope.ts) 第 19 行对 CYCLE 直接抛未开放。目标详情、资料变更和周期复盘已有 1–84 天范围生成，应复用现有能力接入口，而不是重复开发引擎。

当前任务接口提供生成/查询，未提供持久化取消。离开页面停止轮询、放弃已经存在的草稿、取消尚在排队/运行的任务是不同操作。需要定义取消后的结果废弃、重试/去重和任务可恢复状态；不能将返回按钮视作后端取消完成。

### G13 / G14：隐私与运行保障

[我的页面](../../apps/mobile/src/features/profile/screens/ProfileScreen.tsx) 第 290 行明确写数据导出/删除尚未开放。注册隐私说明不等于独立记录 AI 与敏感数据授权；仓库内未找到完整授权、导出/删除请求和处理结果流程。

现有限流主要由[AuthRateLimitService](../../apps/api/src/modules/auth/auth-rate-limit.service.ts) 覆盖注册、登录、刷新。[AI 编排](../../apps/api/src/ai/ai-orchestrator.service.ts) 已有 requestId、模型/用量和审核结果日志，但未见 AI/应用端点限流、异常告警与 PRD 事件的完整关联审计。用户配额/预算属于进一步运行策略，需要结合预算确定，不将未确认额度当既定 PRD 数值。仓库外网关和监控本次未核实。

### G15：目标评价已有基础，仍需区分“事实展示”和“难度评估”

[目标表单](../../apps/mobile/src/features/goals/components/GoalForm.tsx) 支持五类目标，只有 FTP 有结构化目标 W / W/kg，其他类型使用文字达成条件；[契约](../../packages/contracts/src/coach.ts) 也未表达独立距离、爬升、用时等类型化基线/目标指标。

[评价规则](../../apps/api/src/modules/coach/goals/goal-lifecycle.policy.ts) 第 25～79 行已计算 FTP 差距、剩余天数、每周分钟及缺失项；难度主要是通用不确定性说明，尚未形成因目标而异的定性评估或具体多目标冲突分析。不能再把整个可行性评价列为没有实现。细化时不应发明固定 FTP 增长率或未经确认的自动达成阈值。

## 4. 不算本轮遗漏的内容

- 多份候选：当前只有一份真实推荐草稿是 PRD 认可的阶段边界，不能要求伪造 3 份。
- 建档饮食只在本地暂存：PRD 已明确，不列为首份训练生成阻塞。
- 测试协议、设备推荐、固定安全/达成阈值：PRD 后续补充仍列待确认，不擅自给处方。
- 单次课程 1–84 天、阶段路线最多 365 天和 12 阶段：已记录实现限制，超长周期分批。
- 真实短信、年龄/市场、食品来源许可等：属于发布前产品决策；测试阶段任意六位码符合现有 PRD，不把它算当前测试注册错误。
- 模板、增强功率图及导出属于 P1；全面设备/平台同步、多运动、教练协作属于 P2。

## 5. 建议实施顺序和验收

1. 先修真实审核与生产配置、营养禁忌/成分校验、反馈日期与更正。它们影响生成安全和决策事实。
2. 接通版本恢复，以及候选编辑、详细差异和动作排序/双视图。
3. 统一普通调整的事实摘要；处理赛事/测试取舍，确认营养一起应用还是分别确认的产品口径。
4. 补首页/月历/休息事件、时区与档案、目标结构化指标和跨周期分析。
5. 面向真实用户前完成隐私数据路径、授权、运行限流告警和真实环境验收。

每项应包括真实入口、取消/返回、loading/empty/error、输入保留、幂等、归属、版本冲突、草稿失效、正式记录保护、功能文档和对应测试。

## 6. 本次实际验证

- 在 `apps/api` 执行 `./node_modules/.bin/jest --runInBand --silent`：26 组、154 项通过；15 组、122 项跳过。默认运行未启用数据库/真实模型测试条件，跳过不算通过。
- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --silent`：33 组、302 项全部通过。
- 在仓库根通过 `node` 内联脚本，使用 TypeScript `transpileModule` 加载当前营养规则，现有 Zod schema 解析上述四组候选并直接调用校验函数；前三组未阻断、对照组阻断。未改业务数据。
- 类型检查通过：根目录依次执行 `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json --noEmit`、`./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`、`apps/mobile/node_modules/.bin/tsc -p apps/mobile/tsconfig.json --noEmit`，退出码均为 0。
- lint 通过：根目录 `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`；在 `apps/mobile` 执行 `./node_modules/.bin/eslint src app`，退出码均为 0。
- 报告用 Prettier 格式化并检查；`git diff --check` 和相对链接目标检查通过。
- 未执行数据库集成、真实模型、真机、production 部署或备份恢复；本报告不宣称通过 PRD 全量验收。未来反馈日期、时区和 UI 断点除明确说明的函数级复现外，属于静态代码发现。

## 2026-11-09 后续实施：用户选定的三组补齐

上文保留为本次审计时的快照。随后按用户指示实现：

- G05：动作上移/下移，简洁/专业共用草稿及偏好持久化，实时结构图。
- G06：AI 候选局部编辑，详细原/新参数预览，单节/后续范围选择与二次确认；保存后重新校验、版本化确认应用。
- G09：周/月日历，来自时间设置/真实课程的休息/恢复事件，改期冲突检查和替代日期。没有时间设置时保留未知；距离目标不虚构时长，当前要求先改为时间目标后改期。
- G10 中用户指定部分：首页真实状态与证据、目标/阶段、下一测试/比赛、待确认建议；未因此实现目标差距计算和跨周期趋势。

详见 [课程编辑与预览](../features/course-editing-preview.md)、[日历与改期](../features/training-calendar-reschedule.md)、[首页](../features/mobile-home.md) 及 [实际验证记录](../testing/course-calendar-home-2026-11-09.md)。其他审计缺口继续保留，不将本次范围外条目标为完成。

## 2026-11-09 后续需求变更

用户明确取消简洁/专业切换，统一使用专业模式。G05 的排序与实时结构图保留；双视图及偏好持久化不再作为当前验收项，相关 UI、调用、API 和共享契约已移除，历史偏好列保留兼容。上文为初始审计及当时实现快照；当前要求见 [需求变更](../changes/2026-11-09-professional-workout-editor.md)。

G05 排序交互后续更新：已由上下箭头改为六点图标长按拖拽，采用 `react-native-sortables`，人工和 AI 候选编辑入口共用。详见 [当前功能说明](../features/course-editing-preview.md)。
