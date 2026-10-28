# 移动端 UI 一致性重构

## 1. 目的与范围

- 目的：让认证、首页、训练、AI 教练、个人资料和训练深层页面共享同一套 Premium Dark Performance 视觉语言。
- 包含：页面头部、底部操作栏、空状态、按钮触控尺寸、卡片层级、图标、颜色 Token 和训练深层页面返回结构。
- 不包含：API、数据模型、路由业务流程、请求状态和服务端行为。

## 2. 技术实现

- 新增 `AppHeader`、`BottomActionBar`、`EmptyState` 通用 UI 组件。
- 认证页、个人页和 AI 教练页改用统一主题 Token，减少页面级硬编码颜色。
- 训练深层路由隐藏原生 Stack Header，使用统一 AppHeader 保留返回行为。
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

完整移动端 Jest 测试已执行并通过；仓库的 `pnpm`/Expo 封装命令当前受本地 pnpm 数据库文件错误影响。
