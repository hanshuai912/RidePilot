# RidePilot PRD 功能缺口核对

核对日期：2026-11-04（America/Los_Angeles）。

依据：[产品 PRD V2.0](../../../RidePilot_Product/PRD.md)，包含文末 2026-10-30、2026-11-01 已确认补充；同时遵循用户后续明确要求：赛事相关生成必须由用户点击触发，不自动生成。

核对范围：当前仓库移动端页面、API、共享契约、数据库结构和功能文档。本文是静态实现审查，不等于真机、真实模型或生产环境验收；本次未运行测试、启动服务或调用模型。状态中的“已有”仅表示发现对应实现。

## 结论

训练、测试、赛事、营养的基础草稿与确认应用能力已经具备，但尚未覆盖全部 P0。主要缺口在持续教练协作、目标评估、反馈与趋势、跨模块联动，以及安全隐私的正式上线能力。部分能力已有后端，移动端仍无法完成操作，不能按完整功能计算。

不建议给出单一完成百分比：不同需求大小差异很大，且代码存在并不代表已通过实际验收。

## P0 缺口与部分实现

| 编号 | PRD 依据 | 当前状态 | 仍需补齐 |
|---|---|---|---|
| G01 | M09 FR-804/805；§12.1 | 审核接口骨架存在，实际语义审核缺失 | 输入危险请求、提示词注入及输出运动/营养风险审核。当前唯一适配器直接 ALLOW；production 配置会拒绝启动，属于正式上线阻塞项。已有结构和领域校验不等于语义审核。 |
| G02 | M09 FR-806；§12.1/12.5 | 部分实现 | 已有请求 ID、模型/用量日志及提案版本信息；未发现 AI/计划应用的用户级限流与完整审计闭环，缺少审核→提案→用户拒绝/应用的统一追踪及异常告警。登录限流已经存在。配额上限需结合预算决策。 |
| G03 | §12.1；P14 | 缺少可操作产品流程 | 数据导出、删除申请/处理、AI 与健康/饮食数据授权记录、授权版本及第三方模型处理说明。当前隐私入口以说明文案为主，资料页明确提示导出/删除尚未开放。 |
| G04 | M02 FR-101/102/104/106 | 部分实现 | 缺少目标差距、期限、可用时间与不确定性的可行性评估；目标值主要支持功体比，尚缺自定义目标及完整类型化指标。后端支持爬坡类型、主次目标和暂停状态，移动端设置只提供 FTP/耐力/比赛，未形成暂停/恢复、主次切换及多目标冲突处理入口。 |
| G05 | M02 FR-103/105；§3.5 | 阶段生成/确认已具备，阶段决策部分实现 | 阶段目前主要是目的、日期、测试建议；缺少明确的阶段完成条件、证据与继续/延长/恢复等决策状态。阶段时间线按日期判断当前/结束，不能据此判断达成。测试复评已有实测比较和阶段记录统计；不应自动晋级，具体阈值仍待确认。 |
| G06 | §3.5；M09 FR-802 | 部分实现 / 后端未接前端 | AI 教练缺少真实当前阶段、状态判断依据、下一课程/测试、待处理建议和历史汇总。自由问答只有当前计划解释后端，无移动端对话入口。普通调整尚未统一汇总近期训练完成、疲劳/恢复趋势；整个周期调整入口明确未开放。目标中心的自定义日期课程生成已经存在。 |
| G07 | M03 FR-202/204；P03/P04 | 部分实现 | 日历只有周视图，呈现课程与测试，未统一呈现比赛、休息/恢复事件及月视图；缺少清晰的课程改期与冲突替代方案闭环。首页聚合训练和营养，尚未覆盖下一测试、下一比赛和相关待办。 |
| G08 | M04 FR-305/306/307/313；M01 FR-007 | 部分实现 | 动作可增删改，但调整顺序未接交互；缺少简洁/专业视图切换与偏好保存。AI 候选的局部编辑有后端接口，预览页未接入；差异对比主要显示标题/日期/动作数，缺少时长/强度参数差异、营养影响，以及本节与后续联动的完整选择和二次确认。手动课程草稿编辑、重复次数和未保存提醒已经存在。 |
| G09 | M07 FR-603～607；AC-M07 | 部分实现，存在范围不一致 | 赛事影响预览列出赛前后各 7 天，实际训练草稿固定替换比赛所在周；周日比赛无法完整覆盖下周恢复，已过去的比赛周也不能用于当前恢复安排。冲突查询以比赛当天为主，未完整评估相邻赛事恢复间隔、目标阶段、测试移动及营养的关联变化；改期/取消后也缺少统一影响对比。生成仍应由用户明确点击。 |
| G10 | M06 FR-505/506；M10 FR-902/904 | 后端有基础，移动端及跨域应用不完整 | 缺少手动修改餐食份量/用餐时间的入口；训练改变后没有完整串起营养联动建议、对比、可选一起应用及不同步提醒。训练和营养目前分别应用，跨域统一事务尚未实现。赛事补给自身的生成/恢复查看/再次生成流程已存在。 |
| G11 | M08 FR-702～705；M11 | 部分实现 / 分析视图缺失 | 反馈已有完成状态、时长、RPE、疲劳、备注，缺少结构化睡眠/恢复及可选距离、功率/心率数据和显式记录更正流程。未形成连续未完成/显著疲劳的趋势提醒，以及训练量、完成率、能力趋势和目标进度的基础分析页。测试复评中的局部统计已经存在。 |
| G12 | M10 FR-905；§3.5/12.2 | 后端有基础，移动端缺入口 | 历史版本查询与恢复草稿后端已存在，移动端缺少历史列表、版本比较、恢复预览/确认；通用待处理草稿/历史建议入口不完整。关闭页面不等于持久化拒绝提案，生成中取消及取消后的任务状态处理也尚未形成统一闭环。 |
| G13 | M01 FR-002/003/004/006/007 | 部分实现 | 已有生日、身高体重、经验、FTP 和心率区间；训练目的、室内外设备条件、弹性时间/具体时段等尚未完整开放。可用时间主要为星期与分钟数。FTP 更新后缺少“是否重算未来训练区间”的明确选择；现有历史快照应继续保留。 |

以上 G01～G13 是本次按交付能力归组的缺口，不是新增产品模块，也不是 PRD 中新的优先级编号。

## 主要代码证据

### G01 / G02：审核与运行保障

- [AI 模块](../../apps/api/src/ai/ai.module.ts)：只装配 NoopGuardAdapter，production 直接抛出错误。
- [Noop 审核](../../apps/api/src/ai/guardrails/noop-guard.adapter.ts)：始终返回 ALLOW。
- [AI 编排](../../apps/api/src/ai/ai-orchestrator.service.ts)：已有审核调用位置、请求 ID、结构检查、用量日志。
- [鉴权限流](../../apps/api/src/modules/auth/auth.service.ts)：已存在的限流用于注册、登录、刷新。
- 对 API 源码、共享契约及 Prisma schema 检索限流/配额、授权、审计和 PRD 事件名称，未发现上述完整业务闭环；这不排除仓库之外配置了网关限流或外部监控，需要部署验收另行确认。

### G03：隐私

- [个人资料页面](../../apps/mobile/src/features/profile/screens/ProfileScreen.tsx)：数据与隐私区域写明导出/删除尚未开放。
- [隐私说明弹窗](../../apps/mobile/src/features/auth/components/PrivacySheet.tsx)：当前为说明界面。

### G04 / G05：目标与阶段

- [目标契约](../../packages/contracts/src/coach.ts)：目标类型、targetWkg、优先级、状态，缺少完整类型化目标指标与评估结果。
- [目标 API](../../apps/api/src/modules/coach/coach-data.controller.ts)：CRUD 和 readiness，未提供目标可行性评估操作。
- [建档目标选项](../../apps/mobile/src/features/coach/components/InitialPlanSteps.tsx)、[目标保存逻辑](../../apps/mobile/src/features/coach/hooks/useInitialPlan.ts)：设置选项和固定 PRIMARY 写入。
- [阶段契约](../../packages/contracts/src/stages.ts)、[阶段时间线](../../apps/mobile/src/features/goals/components/StageTimeline.tsx)：阶段目的/日期/测试建议及日期状态。
- [测试复评](../../apps/api/src/modules/coach/assessment-review.service.ts)：已有严格可比历史、实测差值、阶段完成记录统计及独立 FTP 更新资格判断。

### G06：持续教练

- [教练首页](../../apps/mobile/src/features/coach/components/CoachHome.tsx)：版本和快捷操作为主，状态区为通用说明。
- [问答服务](../../apps/api/src/modules/coach/coach-chat.service.ts)：解释当前计划，只读，不提供移动端界面。
- [调整范围](../../apps/mobile/src/features/coach/services/adjustment-scope.ts)：整个周期直接提示暂未开放。
- [生成上下文](../../apps/api/src/modules/coach/coach-generation-context.service.ts)：档案/目标/时间/计划/事件上下文已有，普通调整未统一加载近期训练与恢复趋势；测试复评和指定训练记录有独立证据分支。

### G07 / G08：日历与编辑

- [训练日历](../../apps/mobile/src/features/training/screens/TrainingScreen.tsx)：拉取一周课程和测试，没有赛事投影。
- [首页聚合](../../apps/api/src/modules/home/home.service.ts)：profile、training、nutrition。
- [动作列表](../../apps/mobile/src/features/training/components/WorkoutSegmentList.tsx)：只有添加、编辑、删除回调，排序图标没有排序行为。
- [编辑器](../../apps/mobile/src/features/training/components/Editor.tsx)：没有双视图切换。
- [AI 调整预览](../../apps/mobile/src/features/training/components/WorkoutAdjustmentPreview.tsx)、[预览逻辑](../../apps/mobile/src/features/training/hooks/useWorkoutAdjustmentPreview.ts)：简化对比和应用，未接候选局部编辑。
- [候选修改 API](../../apps/api/src/modules/coach/ai-proposal.controller.ts)：后端已提供修改操作，不能误判成前后端都没有。

### G09：赛事范围

- [影响预览](../../apps/api/src/modules/coach/coach-events.service.ts)：impactPreview 查询同日冲突，affectedDates 固定扩展 ±7 天。
- [备赛草稿](../../apps/mobile/src/features/races/hooks/useRaceTrainingDraft.ts)：monday(race.localDate) 和 replace_week。
- [生成上下文](../../apps/api/src/modules/coach/coach-generation-context.service.ts)：RACE_REPLAN 使用周模式，赛事/测试日期主要作为 forbiddenDates。

### G10：营养联动

- [营养功能边界](../features/nutrition.md)：明确尚未实现跨领域一次性原子应用。
- [营养客户端 API](../../apps/mobile/src/features/nutrition/services/nutrition.api.ts)：生成/替换/校验/应用已接入，未接手动提案编辑及训练提案联动流程。
- [餐食替换](../../apps/mobile/src/features/nutrition/components/NutritionSwapSheet.tsx)：替换原因与食物名称，未提供份量/时间编辑。
- [营养提案 API](../../apps/api/src/modules/nutrition/nutrition-proposal.controller.ts)：后端修改提案操作已经存在。

### G11 / G12 / G13：记录、版本与档案

- [训练反馈表单](../../apps/mobile/src/features/training/components/WorkoutFeedbackForm.tsx)、[活动契约](../../packages/contracts/src/coach.ts)：实际反馈字段范围。
- [恢复版本 API](../../apps/api/src/modules/coach/plan-restore.controller.ts)：版本列表/详情/恢复提案已存在；移动端无对应调用与页面。
- [档案契约](../../packages/contracts/src/profile.ts)：生日等基础资料已开放，设备/视图等设置未开放。
- [可用时间契约](../../packages/contracts/src/coach.ts)：星期、可训练分钟数、单次上限。
- [FTP 设置](../../apps/mobile/src/features/profile/hooks/useFtpEditor.ts)：保存能力值后显示成功，没有未来课程重算选择。

## 不应再列为“尚未实现”的核心能力

- 账户/基础档案、FTP 门槛与功率/心率区间。
- 首份计划引导；训练草稿生成、校验、预览、明确确认后应用。
- 手动创建/编辑结构化课程，时间与距离目标、W/%FTP、重复次数、同日多课程。
- 目标阶段独立生成并确认；按已确认阶段或自定义起止日期生成课程。
- 测试安排/改期冲突预览、结果录入/无效标记、历史比较、复评及独立确认更新 FTP。
- 赛事管理、成绩反馈、比赛所在周的备赛调整。
- 饮食档案、每日建议、替换餐食、赛事补给及明确再次生成入口。
- 基础训练反馈、正式版本、归属校验、幂等和版本冲突处理。

上述能力仍需对应自动测试与实际场景验收；本文未重新证明其运行结果。

## 当前限制、待决策项与后续范围

以下不能与遗漏的 P0 混为一谈：

- 单次课程生成 1–84 天，阶段安排最多 365 天、最多 12 阶段：PRD 已记录的当前实现限制；长周期可分阶段生成。
- 阶段安排、测试和具体课程分别操作、分别确认；不要求自动安排测试或自动晋级。
- 建档时饮食信息暂存本地、首份预览先给一份推荐方案：PRD 已认可的当前边界。
- 赛事生成由用户点击触发：用户已明确要求，不能把“不自动生成”当缺陷。
- 默认测试协议、设备推荐、安全阈值、固定达成阈值：仍待产品确认，不能为了补齐自行编造规则。
- 正式短信、适用市场与年龄规则、食品数据源与许可、AI 预算和数据处理区域、提醒方式：按 PRD §17.2 另行决策。
- M12 自定义模板、增强功率曲线、图表导出属于 P1，当前未形成完整交付。
- M13 全面设备/平台同步、多运动、教练协作属于 P2；已有个别集成不代表需要在 P0 补齐全部厂商。

## 建议推进顺序

1. 正式上线前先处理 G01～G03：真实审核、运行保障、隐私授权与数据路径。
2. 补齐反馈与基础趋势，再把这些证据接入持续教练和目标评估，避免生成只能依赖用户临时描述。
3. 优先打通赛事跨周备赛/恢复、训练与营养联动、测试影响对比，解决实际使用中的模块断点。
4. 补齐版本恢复和待处理草稿入口，再完善月历、动作排序、候选局部编辑、双视图等操作能力。

每项应按独立功能拆分，明确数据/接口边界、确认流程、错误状态、测试和功能文档后交付。
