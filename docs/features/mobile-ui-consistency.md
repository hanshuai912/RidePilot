# 移动端 UI 一致性重构

## 1. 目的与范围

- 目的：让认证、首页、训练、AI 教练、个人资料和训练深层页面共享同一套 Premium Dark Performance 视觉语言。
- 包含：页面头部、底部操作栏、空状态、按钮触控尺寸、卡片层级、图标、颜色 Token 和训练深层页面返回结构。
- 不包含：API、数据模型、路由业务流程、请求状态和服务端行为。

## 2. 技术实现

- 新增 `AppHeader`、`BottomActionBar`、`EmptyState` 通用 UI 组件。
- 认证页、个人页和 AI 教练页改用统一主题 Token，减少页面级硬编码颜色。
- 二级路由隐藏原生 Stack Header，使用共享 `NavigationHeader` 保留返回行为；一级 Tab 继续使用 `AppHeader`。
- AI 教练嵌套路由 Stack 明确使用暗色场景背景，避免步骤跳转时显示原生白色转场底色。
- AI 教练资料引导路由使用 180ms 淡入转场，减少默认横向推入动画带来的闪屏感。
- 训练详情补充已有区段数据的结构图展示；不改变数据来源和交互逻辑。
- 所有通用小按钮和训练动作选择控件满足至少 44pt 的触控高度。

## 3. UI 状态与交互

- 保留原有加载、错误、重试、保存、返回、确认和草稿流程。
- 注册页补充密码规则的即时视觉反馈，不改变原有校验规则和提交行为。
- 饮食占位页改为统一空状态表现，仍保持原有功能未接入状态。
- AI 教练无正式计划状态及四个资料引导步骤的操作按钮改为滚动内容底部展示；生成中、候选和差异预览继续使用固定底部操作栏。

## 4. 测试与验证

- `./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json`
- `./node_modules/.bin/eslint src/components src/features app/workouts/_layout.tsx --ignore-pattern dist --ignore-pattern .expo`
- `./node_modules/.bin/jest --runInBand src/features/auth/__tests__/auth-screens.test.tsx`
- `./node_modules/.bin/jest --runInBand src/features/training/__tests__/training-routes.test.tsx`

原 UI 一致性任务验证记录：完整移动端 Jest 测试通过；当时 `pnpm` 封装命令受本地 pnpm 数据库文件错误影响。

## 5. 二级页面导航统一（2026-10-30）

- 参照心率区间页：固定顶部导航，居中 17 pt 标题、左侧 20 pt 返回箭头、两侧等宽 44 pt 触控区域，底部分隔线。正文独立滚动，顶部不展示多行副标题。
- 共享组件：`apps/mobile/src/components/layout/NavigationHeader.tsx`；个人资料页通过 `ProfilePageHeader` 复用，保留“返回我的”无障碍标签。
- 覆盖个人信息、心率区间、骑行功率区间、第三方 App、课程添加/详情/编辑/动作/预览、AI 引导/规划/生成/候选/差异/成功、登录、注册和开发组件预览。COROS 回调为自动重定向的临时加载页，无导航操作。
- 长导航标题改为“编辑课程”“课程预览”“重新规划”“赛后恢复”“准备比赛”“生成草稿”“选择方案”“差异预览”“注册账号”；说明保留在正文并精简。AI 草稿仍需预览、校验并确认应用。
- 编辑未保存返回确认、提交中返回禁用、无历史记录的返回兜底、加载/失败时的返回与重试保持可用；AI 生成页返回复用原有“返回填写”逻辑。
- 不涉及 API、共享契约、数据库或依赖变更。

验收：滚动长表单时导航仍固定；标题居中；顶部返回触发原有退出确认；保存期间顶部返回禁用；加载失败可以返回或重试。自动测试覆盖导航与滚动内容分离、返回目标、未保存动作确认及保存中禁用。具体检查结果见下方本次验证记录。

### 本次验证记录

以下命令在 `apps/mobile` 执行：

- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/eslint src app`：通过。
- `./node_modules/.bin/jest --runInBand`：首次运行 20 个测试套件通过，训练路由新增断言使用了不兼容的查询方法，导致 1 项测试失败；已改用 Testing Library 的 `within`。
- `./node_modules/.bin/jest --runInBand src/features/training/__tests__/training-routes.test.tsx src/features/coach/__tests__/initial-plan-flow.test.tsx`：修正后 2 个套件、42 项测试全部通过，包含新增的生成页与成功页顶部返回验证。
- `./node_modules/.bin/expo export --platform android --output-dir /tmp/ridepilot-navigation-export`：通过，Android JS bundle 与资源导出成功（不等于原生安装包或真机验收）。
- 仓库根目录对全部变更文件执行 `./node_modules/.bin/prettier --check`，通过；`git diff --check` 通过。

真机尚未验收，需检查小屏、大字体、键盘弹出和实际滚动时的导航位置。
