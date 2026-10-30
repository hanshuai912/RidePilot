# 第三方 App

## 目的与用户流程

将第三方连接管理集中到独立页面。“我的”以一张卡片内的三行列表展示“FTP 功率 / 心率区间 / 第三方 App”，点击第三行进入 `/third-party-apps`，原有 COROS 数据卡片迁移到此页。仅进入详情后读取连接状态。

新页复用 FTP 功率页的 `ProfileEditorPage`：黑金暗色背景、固定返回箭头与居中标题、相同内容宽度和内边距、中间内容滚动、底部安全区。连接操作在 COROS 卡片内完成，本页没有单独的保存按钮，不展示底部 Tab 栏。概览三行复用同一石墨灰外框，内部使用对齐标题左沿的细分隔线；保留每行图标、数值或状态和进入箭头，无独立卡片背景或卡片间距。

顶部返回回到上一页；直接打开详情且无历史时回到“我的”。COROS 授权成功或失败均回到“第三方 App”，使用 `dismissTo` 返回已存在的页面，避免授权回调产生重复页面；冷启动时替换回调页。失败提示引导在新页重试。

## 实现与状态

- 路由：`apps/mobile/app/third-party-apps.tsx`，在根布局的已登录 Stack 注册。
- 入口：`apps/mobile/src/features/profile/components/ThirdPartyAppsCard.tsx`。
- 概览分组：`apps/mobile/src/features/profile/components/ProfileSettingsList.tsx`，三行均为独立可点击区域，FTP 和心率数据继续各自加载并在返回时刷新。
- 页面：`apps/mobile/src/features/integrations/screens/ThirdPartyAppsScreen.tsx`。
- 连接卡片：复用 `CorosConnectionCard.tsx`，去掉原来用于概览页的顶部外边距。
- 授权回调：`apps/mobile/app/coros-callback.tsx`。
- 沿用现有加载、未绑定、绑定状态、重新授权、解除绑定确认和错误展示；OAuth 成功深链继续触发卡片重新读取状态。授权 URL 仍由服务端生成，第三方令牌不进入移动端。
- 本次仅调整移动端入口与布局，不修改 API、共享契约、数据库或依赖。训练记录、睡眠、恢复数据的自动同步仍未实现，详见 [外部数据接入](external-mcp-data-integration.md)。

## 验收与验证

- 自动化用例：`apps/mobile/src/features/integrations/__tests__/third-party-apps.test.tsx`，覆盖同一分组内三行的顺序和独立跳转、概览入口、卡片迁移、返回、直接打开、读取和授权失败、冷启动回调、回调栈去重和失败提示。
- 既有 `coros-connection-card.test.tsx` 验证绑定操作仍打开服务端授权地址。
- 手工验收：“我的”只显示第三方 App 入口；详情标题固定且居中，COROS 卡片可操作；返回恢复“我的”；真实 OAuth 授权后回到新页并展示最新状态。

实际执行结果（移动端命令在 `apps/mobile` 目录运行）：

- `./node_modules/.bin/jest --runInBand`：19 个套件、143 项通过，覆盖列表及既有 FTP / 心率详情回归；分组内边距调整后定向重跑 `src/features/integrations/__tests__/third-party-apps.test.tsx`，7 项通过。
- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/eslint src/features/profile src/features/integrations app/third-party-apps.tsx app/coros-callback.tsx app/_layout.tsx`：通过。
- `./node_modules/.bin/eslint src app`：未通过；未修改的饮食模块 `NutritionProfileSheet.tsx:59`、`NutritionSwapSheet.tsx:35` 存在 `react-hooks/set-state-in-effect` 错误，另有两个既有 warning。
- `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-third-party-apps-web`：成功。
- `node /tmp/ridepilot-third-party-apps-review.mjs`：模拟 API 的真实浏览器验证通过。390×844 与 320×568 下只有一个 18 px 圆角分组，行高为 72 / 78 / 72 px，行间无卡片间距，外框无额外内边距，均无横向溢出；进入第三方 App 页和返回通过，新页标题中心分别为 195 / 160 px，底部 Tab 栏不可见。截图位于 `/tmp/ridepilot-settings-list-390.png`、`/tmp/ridepilot-settings-list-320.png` 和 `/tmp/ridepilot-third-party-apps-390.png`、`/tmp/ridepilot-third-party-apps-320.png`。
- 根目录已安装的 Prettier 二进制定向检查及 `git diff --check`：通过。
- pnpm 启动器在沙箱内报告自身数据库无法打开，沙箱外重试后仍无输出，已终止并改用仓库现有二进制执行检查；未安装或修改依赖。
- 无原生或 API 改动，已有开发包刷新 Metro 即可；未在真机执行视觉和真实 COROS 授权验收。
