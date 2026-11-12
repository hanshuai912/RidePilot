# AI 教练 · 赛后恢复

2026-11-12 按用户要求重新设计赛后恢复页面，关联 PRD FR-604、FR-607、FR-802。入口仍为 AI 教练常驻列表「赛后恢复」，无需先登记比赛。已有赛事详情的专属恢复流程继续沿用。

## 页面与交互

- 页面按「现在感觉如何 → 调整哪些训练 → 比赛与恢复情况 → 当前目标与计划依据 → 生成恢复草稿」排列。移除重复介绍、独立上下文大卡和暂未开放的整个周期选项。
- 身体状态为三项整行单选：感觉正常、仍有疲劳、需要充分恢复。它们是本次主观输入，不将「正常」表述为系统允许开始训练。默认状态沿用已有流程，不根据无来源数据判断恢复程度。
- 范围以「下一节／本周剩余／下周」三项紧凑单选展示，选中后就地解释实际影响范围。保留原默认下周；选择下周时明确本周保持不变。切换范围与状态不清空备注，不触发生成请求。
- 比赛与恢复情况选填，支持多行和 240 字输入提示，示例改为公路骑行比赛。正式请求沿用已有 `notes` 200 字上限与截断规则。
- 沿用黑金 Token，24／20／16／13 字号、20 横向留白及 24 分组间距。状态行至少 76，范围按钮至少 48，主按钮 52；小屏允许换行增高。输入框最小高度 112，以本地样式明确覆盖基础 Input 的最小高度，避免 Web 类名顺序导致被压缩。
- 只有一个「生成恢复草稿」主操作，放在滚动内容末尾。错误就地展示；提交期间锁定恢复选择与输入。返回取消本次任务，回到教练首页。

## 实现与请求边界

`RecoveryBrief` 独立承担恢复表单展示，`PlanningBrief` 分发训练调整和恢复任务，`CoachScreen` 沿用页面容器与共享流程。原有训练调整页面保持其独立表单。

原恢复入口仅使用通用范围与身体状态，未明确传递恢复任务用途；本次在现有 `notes` 前添加「赛后恢复：优先考虑恢复需求，再逐步衔接训练」。恢复诉求与本次状态、备注共同提交，即使不填写备注也不会丢失恢复用途；未新增 API 或共享契约。

范围读取、未来未完成课程筛选、版本核对、生成任务取消及重试继续复用 `useInitialPlan` 和 `resolveAdjustmentScope`。日历读取失败保留范围、状态和备注；资料缺失仍进入补全流程。生成只产生草稿，沿用候选预览、校验、确认和正式版本应用，不直接改写计划或已完成记录。没有数据库变更，无需迁移。

## 验证

测试覆盖恢复任务用途传递、无备注请求、日历失败与重试、状态和范围独立切换、输入保留、忙碌禁用、页面错误及返回，以及原训练调整和教练首页回归。

实际执行（移动端命令在 `apps/mobile` 下）：

- `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/recovery-brief.test.tsx src/features/coach/__tests__/initial-plan-flow.test.tsx src/features/coach/__tests__/coach-planning-entry.test.tsx src/features/coach/__tests__/coach-home-loading.test.tsx`：4 组、41 项通过。
- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/eslint src app`：0 错误，已有 `CoachNextWorkoutCard.tsx` 未使用导入警告 1 条；本轮修改的 7 份源码／测试单独 ESLint 无错误或警告。
- `./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-recovery-web --max-workers 2`：通过，3870 个模块。
- `node /tmp/ridepilot-recovery-browser.cjs`：实际 Web 导出在 320／390／430 宽度无横向溢出；验证区块顺序、六个至少 44pt 的选项、独立切换、字数与输入保留、112pt 输入框、唯一生成入口、日历错误保留与返回首页。未触发业务写请求，无页面脚本错误。截图 `/tmp/ridepilot-recovery-{top,form}-{320,390,430}.png`。
- `node /tmp/ridepilot-recovery-design-check.cjs`：设计稿同三种宽度、状态／范围单选、输入字数及首页／五栏原型恢复入口通过。A05 HTML、交接说明、A01 入口和 `design/decisions.md` 已同步。
- 修改文件 Prettier 检查、主仓库及设计仓库 `git diff --check`：通过。

验证使用合成 API 数据和模型替身；本次未执行 iOS／Android 真机、系统大字体或真实模型联调。浏览器无法验证原生软键盘与安全区表现。
