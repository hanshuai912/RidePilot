# 目标阶段与按范围生成课程

2026-11-10 后续修正：阶段、测试和课程已改为全部进行中目标共同规划，共享一份阶段和测试日程；目标切换仅改变概览，保留共享规划输入。旧单目标阶段保留为历史，明确重新生成并确认后替换。当前行为、数据兼容及验证见 [多目标综合训练规划](unified-goal-planning.md)，下文各日期记录保留为开发历史。

## 范围与流程

2026-10-30 用户确认：FTP 必填；具体课程可按阶段或起止日期生成。训练页和 AI 教练提供“目标与阶段”入口，进入目标列表、目标详情。阶段生成独立于课程生成，不自动发布训练，也不自动安排测试。

1. 无 FTP：直接进入骑行功率区间设置，保存后返回原页面，保留日期、阶段选择、备注及手动课程草稿。
2. 阶段：选择起止日期，生成结构化阶段草稿 → 独立预览页 → 确认阶段安排。旧阶段仅在确认事务成功后归档。
3. 课程：选择当前阶段或输入日期范围 → 生成草稿 → 预览拟替换课程与新课程 → 校验 → 明确确认 → 原子应用 → 训练日历读取新版本。

## 规则

- FTP 门槛覆盖 AI 周计划、范围生成、调整和手动课程创建、编辑、校验及应用；绝对功率 W 也不能绕过。历史查看和实际训练反馈仍可使用。
- 单次课程生成 1–84 天；阶段安排最多 365 天、12 个连续阶段，每阶段最多 84 天。这是本次实现对输出长度的限制，不是用户已确认的训练周期政策；界面明确说明。较长周期分阶段生成课程。
- 日期范围无需周一开始。阶段日期由服务端从当前用户的已确认阶段解析；不接受客户端覆盖阶段日期。已过去日期不生成新课程。
- 只替换范围内当天及未来、没有实际记录的课程；已记录和范围外课程连同稳定记录关联一并保留。返回影响日期包含删除课程日期。
- 模型输出必须覆盖每个存在可训练日期的自然周，避免多周请求只得到首周课程。不可训练日、赛事/已安排测试、每日及单次时长和现有安全功率/恢复规则继续校验。
- 阶段确认及课程应用检查目标、FTP、可训练时间、运动档案和当前阶段/正式计划版本；发生变更需重新生成。阶段重新确认不会隐式覆盖既有课程。
- 生成复用现有异步任务、Skill 和服务端模型适配器；前端不持有模型密钥。模型失败不修改正式计划。
- 骑行适配规则升级至 1.2.0，阶段和多周范围使用独立场景引用，避免套用单周七天限制；选中阶段的训练目的和复评方向进入课程生成上下文。

## 实现

- 契约：`packages/contracts/src/stages.ts`、`coach.ts`。
- 后端：`stage-plans.service.ts`、`stage-plan.validation.ts`、`training-range.service.ts`；周/范围公共上下文拆为 `coach-generation-context.service.ts`，避免继续扩大任务 Worker。
- 课程应用复用 `CoachProposalService` 的版本化事务、用户锁和幂等入口。该服务继续集中保留既有发布事务和校验流程；没有复制第二套发布逻辑。
- 移动端：`features/goals` 分离 screens、components、hooks、services，路由 `/goals`、`/goals/[goalId]`、`/goals/stage-preview`、`/goals/course-preview`。
- UI：现有黑金 Tokens、`NavigationHeader`、`TrainingPage`、`PlanPreview`；短标题、固定顶部、独立预览路由。

## 状态与失败恢复

首次读取有 loading、错误重试及目标空状态；旧数据刷新失败展示错误。未确认草稿不影响正式安排。生成失败保留条件；不确定网络结果保留请求与幂等键；轮询超时可继续查询原任务。确认应用响应丢失时直接使用相同提案、基准版本和幂等键重试，不先编辑或重验已应用草稿。确认阶段响应丢失时同一草稿和原 expectedVersion 可重试。提交中禁止重复操作和返回；备注有未保存离开确认。

## API、数据与迁移

见 [AI 教练 API](../api/ai-coach.md) 和 [AI 教练数据](../data/ai-coach.md)。新增迁移 `20261030160000_training_stages`，只新增阶段表和索引，无既有数据回填。阶段测试录入与复评的移动端完整流程仍为后续任务，本功能的复评内容仅为建议说明。

## 验证

自动化覆盖：无 FTP 拦截、阶段连续性和完整性、任意跨周范围、草稿不自动发布、用户归属、阶段确认幂等、FTP 更新阻断旧阶段、阶段替换阻断旧课程草稿、已记录与范围外课程保护、影响日期及课程发布幂等；移动端覆盖 FTP 路由、返回保留条件、阶段/日期请求、确认失败保留和应用超时重试。

测试文件：`apps/api/test/goal-planning.e2e-spec.ts`、`stage-plan.spec.ts`、`training.validation.e2e-spec.ts`；`apps/mobile/src/features/goals/__tests__/goal-planning.test.tsx`，并回归既有训练和 AI 教练用例。AI 集成测试使用模型替身；不代表真实模型生成质量或真机验收。

2026-10-30 实际执行：

- `pnpm --filter @ridepilot/api test:integration`：最终 23 套件、110 项通过；1 个真实模型测试按开关跳过。隔离测试库迁移成功。
- 移动端 `./node_modules/.bin/jest --runInBand`：22 套件、192 项通过。随后新增两个手动 FTP 返回用例，并重跑受影响的训练路由套件，37 项全部通过；目标规划套件最终 6 项通过，包含带输入条件的预览确认应用。
- `pnpm build`：contracts 与 API 构建通过。API `./node_modules/.bin/tsc -p tsconfig.json --noEmit`、移动端 `./node_modules/.bin/tsc --noEmit` 通过。
- 移动端 `./node_modules/.bin/eslint src app`、根目录 `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`、本次修改文件 Prettier 检查及 `git diff --check` 通过。
- API `./node_modules/.bin/prisma validate`、`prisma generate` 通过；`pnpm --filter @ridepilot/api db:deploy` 已将新增表迁移应用到本机非生产开发库。
- 移动端 `./node_modules/.bin/expo export --platform android --output-dir /tmp/ridepilot-goal-range-android` 通过。

未执行实体设备操作验收与真实模型调用；较长课程范围的真实生成耗时和输出质量需要后续联调。测试运行有现有 pg 并行查询弃用提示，不影响本轮通过结果。

2026-10-30 后续补充：阶段建议现可单独安排测试日程、录入结果、复评，并关联后续范围课程草稿；具体行为见 [阶段测试与后续课程](stage-assessments.md)，不自动创建或晋级。

## 目标生命周期与阶段复评接入

目标详情增加目标管理与阶段复评入口，测试详情和周期复盘可就地继续。复评记录达成条件、真实训练/测试快照及用户决定，后续阶段/课程生成可绑定 stageReviewId，并在草稿预览展示该来源。新决定或证据变化使旧草稿无法继续确认。目标延期、暂停、完成及建立下一目标不会自动改写课程；延长阶段先确认新阶段安排，再规划课程。完整 API、迁移与验证说明见 [目标生命周期与阶段复评](goal-lifecycle-stage-review.md)。

## 2026-11-10：目标与阶段页面优化

按 `RidePilot_UI/AGENTS.md` 校准移动端黑金暗色排版：分区标题 20、卡片标题 17、正文 16、辅助标签 12–13，目标 FTP/功体比数字 32 并使用等宽数字；区块间距 24、卡片内边距 16–20。未修改全局 Token、API、契约或数据库。

- 目标列表按当前活跃主目标、其他未关闭目标、历史目标分组，整卡进入详情。区分用户确认完成与主动结束，保留建立目标与首次建档入口，移除无数据来源的兜底口号。初次加载失败显示错误和重试，不再同时显示无限加载图标。
- 详情将目标状态、管理入口、实际目标指标、日期、当前 FTP 与达成条件集中在目标摘要中；缺失条件明确标为待补充，不添加虚构进度。
- 阶段时间线默认展开当前或最近未来阶段，其他阶段按需展开。阶段测试和复评操作留在展开内容中；“日期已结束”不代表能力达成。阶段草稿预览完整展示，不按日期伪装成正式阶段。失效阶段和已结束阶段不能被选择用于课程生成。
- 阶段测试、后续课程规划分区展示。日期范围与所选阶段使用同一生成表单；首次切换所选阶段时，就地展开阶段选择器，展示名称、日期与当前/后续/已结束状态。选中后收起，可在原位置重新选择，无需返回上方时间线。阶段选择统一在此表单完成，上方时间线移除“选择此阶段生成课程”按钮，只保留浏览、测试与复评。只切换或选择不会触发生成，日期和补充要求保留。
- 没有有效阶段时禁用阶段课程生成；保留按日期生成和重新规划阶段。后续入口去重后，阶段规划统一从「阶段安排」标题旁打开，课程只保留单个生成入口。原草稿预览、校验、用户确认、幂等与冲突检查继续执行。
- 提取 `GoalSummaryCard`、`GoalListCard`、`GoalCoursePlanner`、`GoalStagePicker` 与日期/状态展示函数，详情容器只组合流程；阶段测试组件仅增加分组间距。

相关自动化覆盖目标分组/导航、阶段展开与表单选择相互独立、表单就地选阶段、日期与补充要求保留、失效/结束阶段禁用、按阶段提交 ID、失败重试以及草稿预览和确认。

本次最终执行：

- `pnpm --filter @ridepilot/mobile typecheck`、`pnpm --filter @ridepilot/mobile lint`：通过。
- `pnpm --filter @ridepilot/mobile test -- --runTestsByPath src/features/goals/__tests__/goal-planning.test.tsx src/features/goals/__tests__/goal-lifecycle.test.tsx src/features/assessments/__tests__/assessment-routes.test.tsx`：3 组、29 项通过。
- `pnpm --filter @ridepilot/mobile exec expo export --platform web --output-dir /tmp/ridepilot-goals-layout-web --max-workers 2`：导出成功，3837 个模块。
- `node /tmp/ridepilot-goals-layout-browser.cjs`：使用合成 API 数据验证 320/390/430 宽度、目标分组与导航、实际字号、阶段展开、表单内选择及切换阶段、输入保留、失效阶段禁用、缺少 FTP、关闭目标历史、空列表与错误重试；没有生成/应用请求和页面脚本异常。截图位于 `/tmp/ridepilot-goals-*.png`。
- 对本次修改执行 Prettier 格式检查及 `git diff --check`。

未执行 iOS/Android 真机、系统大字体或真实模型端到端验证。目标管理、复评与确认页面沿用原流程，本次重点优化列表和目标与阶段详情。

### 阶段安排说明按需查看

目标详情的「阶段安排」标题后增加圆形叹号图标，触控区为 44×44，点击后使用既有暗色 `Dialog` 展示阶段规划摘要，点击「知道了」、遮罩或系统返回可关闭。长文案可在弹窗内滚动。

详情时间线默认隐藏这段摘要，阶段卡片、测试、复评和失效警告继续展示。无阶段安排或摘要为空时不显示提示入口；阶段草稿预览仍完整展示摘要，确认流程不变。查看说明不修改输入、不调用生成 API。

实现为独立 `StagePlanHeading`，`StageTimeline` 的 `showSummary` 默认为 true，仅详情页设为 false。补充交互测试覆盖默认隐藏、打开/关闭/再次打开、输入保留、无阶段入口隐藏及预览摘要保留。

本次执行 `pnpm --filter @ridepilot/mobile typecheck`、`pnpm --filter @ridepilot/mobile lint` 均通过；`pnpm --filter @ridepilot/mobile test -- --runTestsByPath src/features/goals/__tests__/goal-planning.test.tsx src/features/goals/__tests__/goal-lifecycle.test.tsx`：2 组、23 项通过。修改文件的 Prettier 检查和 `git diff --check` 通过。本次未重新导出 Web 或执行真机验证；无 API、契约或数据库变更。

### 阶段测试操作与后续训练规划

- 阶段卡片将「安排测试」放在测试建议标题右侧，底部保留「复评并选择下一步」，避免连续堆叠两个按钮。目标详情「阶段测试」标题右侧为轻量「+ 安排测试」入口；已有测试整卡点击进入详情，右侧箭头提示导航，取消卡片内独立的「查看测试」按钮。测试列表同时供训练日历复用，原测试 ID、目标/阶段关联、默认日期和禁用条件保持。
- 「规划后续训练」采用分段切换、日期/阶段、补充要求、生成课程草稿的层级。后续入口去重后移除卡片下方「阶段规划与重新生成」折叠区，阶段规划移到「阶段安排」标题旁；上方时间线不提供课程生成选择。
- 开始和结束日期均为点击打开的黑金底部年月日滚轮，确认才更新表单；取消、遮罩和系统返回放弃临时选择，滚轮尚在滚动或生成中不能确认。日期以 `YYYY-MM-DD` 传给既有 API，不引入时刻或 UTC 日期偏移。
- 开始日期不能早于用户时区今天，结束日期不能早于开始日期；跨月自动限制月底与闰年日期。开始日期越过原结束日期时按原范围天数顺延结束日期，避免倒置。结束选择最多覆盖从开始起 365 天；课程范围超过 84 天时显示就地提示并禁用课程生成，仍允许阶段规划。
- 显示所选范围的总天数；按用户要求不提供 7／14／28 天快捷范围。切换所选阶段、返回日期范围或进入设置后返回仍保留日期与补充要求；不会因选择日期自动调用生成或应用接口。
- 提取 `GoalPlanningDates` 和公共 `DatePickerField` / `DatePickerSheet` / 日期模型；复用个人档案抽出的 `DateWheelColumn` 与日期样式，保留出生日期限制和原交互。

新增/调整测试覆盖整卡查看、标题安排测试、读取中与失败重试、日期确认与取消、闰年、范围顺延、365 天上限、84 天课程拦截、无快捷范围、阶段测试参数及禁用状态；回归课程草稿预览/校验/确认、设置返回保留、训练日历及出生日期滚轮。

本次最终验证：

- `pnpm --filter @ridepilot/mobile typecheck`、`pnpm --filter @ridepilot/mobile lint`：通过。
- `pnpm --filter @ridepilot/mobile test -- --runTestsByPath src/features/assessments/__tests__/assessment-routes.test.tsx src/features/goals/__tests__/goal-planning.test.tsx src/features/goals/__tests__/goal-planning-dates.test.tsx src/features/goals/__tests__/stage-timeline-actions.test.tsx src/features/goals/__tests__/goal-lifecycle.test.tsx src/features/profile/__tests__/birth-date-field.test.tsx src/features/profile/__tests__/birth-date.test.ts src/features/training/__tests__/training-routes.test.tsx`：8 组、106 项全部通过。
- `pnpm --filter @ridepilot/mobile exec expo export --platform web --output-dir /tmp/ridepilot-tests-layout-web --max-workers 2`：成功，3842 个模块。
- `node /tmp/ridepilot-planning-ui-browser.cjs`：合成 API 数据下通过 320/390/430 宽度、44pt 测试安排入口、无快捷范围、无日期文本输入、日期确认/取消、跨年滚轮对齐、切换阶段保留日期与备注、缺少 FTP 状态检查，无生成/应用请求或页面脚本异常。截图 `/tmp/ridepilot-tests-*.png`、`/tmp/ridepilot-planning-*.png`。
- 修改文件 Prettier 检查与 `git diff --check` 通过。

无 API、契约、依赖或数据库变更；未执行 iOS/Android 真机、系统大字体或真实模型端到端验证。

### 阶段规划入口去重

按用户确认移除下方「阶段规划与重新生成」折叠区及独立的「重新生成课程草稿」按钮，课程规划统一使用「生成课程草稿」，继续支持按日期或所选阶段生成、预览、校验和确认。

「阶段安排」标题右侧增加「重新规划阶段」，无阶段时显示「规划阶段」。点击只展开就地日期表单，不提交请求；可以收起并保留日期。说明叹号仍只展示已有规划摘要。缺少 FTP 或目标非活跃时隐藏阶段规划入口。

新增 `GoalStagePlanner` 负责阶段表单，复用日期滚轮。阶段和课程分别维护日期，调整阶段不会改变课程日期、阶段选择或备注。阶段默认从用户时区今天到已有阶段结束日或目标日期，最长 365 天。用户点击「生成阶段草稿」后才调用现有接口；已有安排时带 `forceRegenerate`，首次规划不强制重新生成。阶段替换仍须草稿预览和确认，现有课程不会随阶段生成自动修改。失败保留日期，不确定响应重试继续使用同一请求和幂等键。

本轮无 API、契约、依赖或数据库变更。

本轮实际验证：

- `pnpm --filter @ridepilot/mobile typecheck`、`pnpm --filter @ridepilot/mobile lint`：通过。
- `pnpm --filter @ridepilot/mobile test -- --runTestsByPath src/features/goals/__tests__/goal-planning.test.tsx src/features/goals/__tests__/goal-planning-dates.test.tsx src/features/goals/__tests__/goal-lifecycle.test.tsx src/features/assessments/__tests__/assessment-routes.test.tsx`：4 组、46 项通过。覆盖单个课程入口、阶段首次规划/重新规划、独立日期保留、不确定失败幂等重试、缺少 FTP/暂停目标、预览确认与原课程流程。
- `pnpm --filter @ridepilot/mobile exec expo export --platform web --output-dir /tmp/ridepilot-stage-entry-web --max-workers 2`：成功，3843 个模块。
- `node /tmp/ridepilot-stage-entry-browser.cjs`：合成 API 数据下通过 320/390/430 宽度的标题入口、44pt 触控区、展开布局、课程入口去重、独立日期、收起保留、说明弹窗、无 FTP/已关闭目标及首次阶段规划入口验证，无写请求或脚本异常。截图 `/tmp/ridepilot-stage-heading-*.png`、`/tmp/ridepilot-stage-form-*.png`、`/tmp/ridepilot-course-entry-*.png`。
- 修改文件 Prettier 检查与 `git diff --check` 通过；未执行真机或真实模型端到端验证。
