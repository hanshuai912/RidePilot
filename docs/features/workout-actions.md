# 训练调整与完成记录路由

## 目的与范围

将首页和课程详情的 AI 单节调整、完成记录从详情内抽屉迁移为独立页面，减少首页操作时的连续转场。遵循 `RidePilot_UI/AGENTS.md`：黑金暗色、统一 17 pt 居中固定导航、左返回箭头、独立滚动正文、安全区和键盘避让。

## 用户流程

- 首页“调整这节训练” → `/workouts/adjust`；“记录完成情况” → `/workouts/feedback`。参数仅包含课程 ID 与来源 `source=home`，不先挂载课程详情。
- 课程详情的相同操作复用这些页面，来源为 `source=detail`。没有来源或不合法来源时使用训练日历作为默认返回目标。
- 调整：选择原因及备注 → 生成草稿 → `/workouts/adjustment-preview` → 查看差异 → 校验并确认应用。预览路由仅传课程 ID、草稿 ID 与来源，可重新加载服务端草稿；返回修改保留上一页输入。
- 反馈：完成/部分完成/跳过 → 实际时长、RPE、疲劳及备注 → 保存。记录结果不自动修改计划。
- 取消或顶部返回复用路由历史；无历史时按来源兜底。表单有修改时退出需确认；生成、校验、应用及保存中阻止原生返回和顶部返回，防止重复提交。
- 成功后从首页进入的流程回首页，首页聚焦时只请求一次聚合接口；反馈从详情进入则回详情并刷新；调整从详情/训练进入则回日历读取新版本，避免旧课程 ID。
- 旧 `/workouts/[workoutId]?action=adjust|feedback` 链接保留重定向兼容，直接进入新页面，不挂载详情内容或打开抽屉。

## 实现与边界

- `app/workouts/adjust.tsx`、`feedback.tsx`、`adjustment-preview.tsx` 是路由壳，隐藏原生 Stack Header，复用 `TrainingPage` 与 `NavigationHeader`。
- 表单拆为 `WorkoutAdjustmentForm` 与 `WorkoutFeedbackForm`，保留本页输入；加载失败可重试，失败不改变正式计划或清空输入。已记录课程禁止重复记录及调整，不可编辑课程禁止调整。
- `useWorkoutAdjustment` 负责生成和轮询，卸载后忽略结果；`useWorkoutAdjustmentPreview` 负责读取、校验和应用。预览校验草稿属于当前单节调整；应用响应超时后在当前页面重试相同幂等键，不再次校验或创建新写入。
- `useWorkoutFeedback` 使用共享 `activityInputSchema` 校验输入后提交，时长为 0–1440 的整数，RPE 与疲劳为 1–10 的整数，空值可选。错误保留字段输入。
- `useWorkoutActionExit` 在成功状态提交后再退出，避免未保存/忙碌保护误拦截成功跳转；详情重新聚焦后重新读取数据。
- 路由参数不是权限凭证。API 继续使用当前 Access Token，归属校验、版本冲突、正式计划事务和记录唯一性均由现有后端实现。
- 本次不变更 API、共享契约、数据库或依赖。生成和反馈表单输入仅在当前路由会话内保留，退出进程不会恢复；预览可凭服务端草稿 ID 恢复。

## 验证

测试文件：`src/features/home/__tests__/home-screen.test.tsx` 与 `src/features/training/__tests__/training-routes.test.tsx`。

在 `apps/mobile` 实际执行：

- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/eslint src app`：通过。
- `./node_modules/.bin/jest --runInBand src/features/training/__tests__/training-routes.test.tsx src/features/home/__tests__/home-screen.test.tsx`：2 个套件、46 项测试通过。
- `CI=1 ./node_modules/.bin/expo export --platform android --max-workers 2 --output-dir /tmp/ridepilot-workout-actions-android`：Android bundle 与资源成功导出。
- 仓库根目录对变更文件执行 `./node_modules/.bin/prettier --check` 及 `git diff --check`：通过。

覆盖：首页单次直接跳转/取消返回、详情入口、成功后的首页与详情刷新、表单未保存提醒、忙碌阻止返回、重复提交保护、失败保留输入、非法数值、已记录课程、读取失败重试、预览返回保留输入、草稿不匹配、应用超时使用相同幂等请求重试。

真机的小屏、键盘、滚动及转场流畅度尚需设备验收。

## 2026-11-12：具体课程调整表单与顶部生成

按用户要求重设计 `WorkoutAdjustmentForm`；本节取代上述调整页底部取消操作说明，完成记录页面沿用原操作。

- 正文按当前课程摘要、主要调整原因、影响范围、补充说明组织。摘要读取真实课程名称、日期、已知时长和正式版本，不补造缺失数据。
- 六项原因排成两列，使用统一的金色选中底色、边框与勾选；范围为「仅此课程」「联动后续课程」两项紧凑单选，并显示当前范围说明。默认值、原因枚举及业务语义保留。
- 复用黑金 Token：20 横向留白、24 分区间距、20 分区标题、16 正文、13 辅助文字，原因和范围高至少 48。输入改为至少 120 高的多行区域，最大 200 字并展示字数。
- 生成操作移到固定标题右侧，精简为单行金色「生成」，无水平内边距，触控至少 44×44。移除正文中的生成和取消按钮，左上返回继续保留来源导航与未保存确认。
- 联动时复用 `DatePickerField` 的年／月／日滚动选择器，最早为当前课程日期，最晚为其后第 83 天，含首日共 84 天，默认结束为第 7 天。取消不修改，确认才更新。非法范围仍阻断生成。
- 点击顶部生成才执行：单节直接请求替代草稿；联动先确认日期范围，「返回修改」不生成且保留输入，明确确认后才调用现有范围生成。之后继续差异预览、规则校验和确认应用，不提前改正式计划。
- 生成期间顶部操作显示加载并禁用，原因、范围、日期和备注锁定；原生与顶部返回仍受忙碌保护。既有长任务取消能力保留。读取失败、FTP 缺失及课程不可编辑时不展示生成操作。
- 切换原因、范围和取消日期选择均不清空备注。生成失败、预览返回继续保留输入。错误仍展示真实消息并允许从顶部重试。

职责拆分：`WorkoutAdjustmentScreen` 负责真实课程、顶部动作与生成服务；`useWorkoutAdjustmentForm` 管理范围、原因、备注及生成前确认；`WorkoutAdjustmentForm` 展示输入与确认，`WorkoutAdjustmentScope` 展示范围和日期。结束日期默认值由已加载的课程日期派生，不在课程数据尚未加载时计算无效日期。

未修改 API、共享契约、鉴权、幂等、版本冲突和应用服务；没有数据库迁移或新增依赖。设计同步 `RidePilot_UI/design/screens/T05-workout-adjustment.html`、同名交接 Markdown 与 `design/decisions.md`。

### 本次实际验证

移动端命令均在 `apps/mobile` 执行：

```sh
./node_modules/.bin/jest --runInBand --runTestsByPath \
  src/features/training/__tests__/workout-adjustment-form.test.tsx \
  src/features/training/__tests__/workout-enhancements.test.tsx \
  src/features/training/__tests__/training-routes.test.tsx
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint \
  src/features/training/components/WorkoutAdjustmentForm.tsx \
  src/features/training/components/WorkoutAdjustmentScope.tsx \
  src/features/training/screens/WorkoutAdjustmentScreen.tsx \
  src/features/training/hooks/useWorkoutAdjustmentForm.ts \
  src/features/training/__tests__/workout-adjustment-form.test.tsx \
  src/features/training/__tests__/workout-enhancements.test.tsx \
  src/features/training/__tests__/training-routes.test.tsx \
  src/features/training/__tests__/fixtures/WorkoutAdjustmentFormHarness.tsx
./node_modules/.bin/expo export --platform web \
  --output-dir /tmp/ridepilot-workout-adjustment-web --max-workers 2
```

- Jest：3 组、51 项通过，覆盖唯一顶部生成、正文无取消、未保存退出确认、范围日期上下界、日期取消与确认、联动范围二次确认及对应 API、单节生成、失败保留输入、预览返回、忙碌禁用与应用幂等重试。
- TypeScript、修改文件 ESLint：通过。Web 导出成功，3873 个模块。
- `node /tmp/ridepilot-workout-adjustment-browser.cjs`：合成 API 检查 320／390／430 屏宽的单节和联动布局、顶部单行生成及正文无重复操作、触控尺寸、120 高备注、范围切换、日期取消和确认、联动确认返回、读取目标失败后保留输入、课程不可编辑、缺少 FTP 与读取重试。无业务写请求和页面脚本错误。
- `node /tmp/ridepilot-workout-adjustment-design-check.cjs`：T05 设计稿三种屏宽、唯一顶部操作、选中状态、输入保留与无横向溢出通过。
- 本次修改文件 Prettier、主仓库与设计仓库 `git diff --check`：通过。

浏览器使用合成数据，不替代 iOS／Android 真机、系统大字体、原生键盘和真实模型联调。

## 2026-11-13：明确调整操作

单课调整的主要提交操作移至表单结尾并命名“生成调整草稿”，继续通过既有范围确认、校验和预览后应用。完整范围、验证命令与验收边界见 [全局页面结构优化](global-ui-ux-structure.md)。
