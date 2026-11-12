# AI 教练 · 调整训练

2026-11-12：按 `RidePilot_UI/AGENTS.md` 重设计训练调整表单，与赛后恢复页保持黑金视觉、字体与间距一致。

## 页面与操作

入口为 AI 教练「调整训练」。顶部返回教练首页。正文按以下顺序组织：

1. 「调整接下来的训练」与一句说明。
2. 三项紧凑范围单选：下一节、本周剩余、下周；下方显示当前范围说明，保留原默认下周。不展示尚未支持的整个周期。
3. 「有哪些变化」：四个两列快捷选项（时间不足、强度偏高、训练环境变化、调整训练重点）、选填说明与字数。
4. 当前目标和日期卡片，右侧「修改」与箭头进入既有教练目标步骤。
5. 正式计划版本及确认后生效说明，末尾仅一个「生成训练调整草稿」。

复用现有 `AppText`、`Input`、`CoachPage`、`NavigationHeader` 与品牌 Token；正文标题 24、分区 20、正文 16、辅助 13，左右留白 20、分组间距 24。范围触控高至少 48，快捷选项至少 44，多行输入高至少 120。目标长文案与小屏自然换行，表单和主操作整体滚动。

快捷选项将预设语句换行追加到说明，不替换用户手写内容。说明包含完整预设句时，该选项选中且禁用，防止重复追加；用户可直接编辑或删除，删除后可再次添加。追加会超过 240 字时禁用该选项，不截断已输入内容。选择快捷项不生成草稿。

## 状态与业务边界

- 范围切换保留说明，生成期间范围、快捷选项、输入及目标修改均禁用；完成后恢复编辑。
- 日历读取失败保留说明与范围，沿用原错误和重试；资料不足继续使用补资料路径。
- 目标页保存后沿既有流程继续调整并保留范围与说明。目标页顶部返回仍进入教练首页；浏览器后退可回到原调整表单。
- 下一节针对实际最近未完成课程；本周和下周使用现有范围解析。已完成记录保留，正式计划版本冲突继续阻断应用。
- UI 说明最大 240 字。提交沿用现有 `useInitialPlan` 备注组合与 200 字截断，不修改共享契约及服务端能力。
- 生成、草稿预览、规则校验、明确确认后应用沿用原流程。无新 API、数据库修改或迁移，不调用真实模型做界面验证。

## 实现位置

- `ReplanBrief.tsx`：页面信息层级、范围与当前目标。
- `ReplanNote.tsx`：快捷补充、输入和字数边界。
- `PlanningBrief.tsx`：传递生成忙碌状态。
- 设计同步 `RidePilot_UI/design/screens/A03-training-adjustment.html`、同名 Markdown 与 `design/decisions.md`。

## 实际验证

以下移动端命令均在 `apps/mobile` 执行：

```sh
./node_modules/.bin/jest --runInBand --runTestsByPath \
  src/features/coach/__tests__/replan-brief.test.tsx \
  src/features/coach/__tests__/coach-planning-entry.test.tsx \
  src/features/coach/__tests__/initial-plan-flow.test.tsx \
  src/features/coach/__tests__/coach-home-loading.test.tsx \
  src/features/coach/__tests__/recovery-brief.test.tsx \
  src/features/coach/__tests__/adjustment-scope.test.ts
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint \
  src/features/coach/components/ReplanBrief.tsx \
  src/features/coach/components/ReplanNote.tsx \
  src/features/coach/components/PlanningBrief.tsx \
  src/features/coach/__tests__/replan-brief.test.tsx \
  src/features/coach/__tests__/initial-plan-flow.test.tsx
./node_modules/.bin/expo export --platform web \
  --output-dir /tmp/ridepilot-replan-web --max-workers 2
```

- Jest：6 组、54 项通过。覆盖追加、去重、删除后再添加、字数不足不截断、范围切换保留输入、忙碌禁用与恢复；原范围解析、草稿及恢复流程回归通过。更新了旧标题的断言。
- TypeScript、修改文件 ESLint：通过。Web 导出成功，3871 个模块。
- `node /tmp/ridepilot-replan-browser.cjs`：合成 API 验证实际导出的 Web 在 320／390／430 宽度无横向溢出；范围文案保持单行、控件至少 44、输入至少 120、单一主按钮，快捷追加与字数上限生效。日历错误保留范围和说明，目标入口及浏览器返回保留说明，顶部返回教练正常。无业务写请求和脚本错误。
- `node /tmp/ridepilot-replan-design-check.cjs`：A03 设计稿三个屏宽、触控尺寸、范围切换、追加、去重与字数边界通过。
- 本次修改文件 Prettier 检查、主仓库与设计仓库 `git diff --check`：通过。

浏览器与设计稿使用合成数据。未执行 iOS／Android 真机、系统大字体、原生键盘或真实模型端到端验证。
