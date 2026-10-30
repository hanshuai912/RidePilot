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
