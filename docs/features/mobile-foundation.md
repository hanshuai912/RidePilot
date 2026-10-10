# 移动端工程基础

## 1. 目的与范围

为 RidePilot 建立 React Native 移动端基础工程。本次只包含 Expo 项目骨架、Expo Router 路由壳和 V1 暗色 Design Tokens，不实现业务页面、鉴权、API 调用或原生设备能力。

## 2. 技术实现

- `apps/mobile/`：Expo SDK 57 + React Native 0.86 + TypeScript；Web 端显式固定 `react` 与 `react-dom` 为同一版本 `19.2.3`。
- `apps/mobile/src/app/`：Expo Router 文件路由入口。
- `apps/mobile/src/app/(tabs)/`：首页、训练、饮食、AI 教练、我的五个一级路由壳。
- `apps/mobile/src/theme/tokens.ts`：暗色主题颜色、间距、圆角、字号和触控尺寸。
- `apps/mobile/app.config.ts`：动态 Expo 配置，启用 `expo-router` Config Plugin、暗色系统主题和 typed routes。

## 3. 原生扩展边界

当前不生成 `ios/` 或 `android/` 目录，也不实现 Expo Module。未来原生配置通过 Config Plugins 管理；需要自定义原生能力时再按 Expo Modules 方案添加模块，并使用开发构建验证，不直接把生成目录作为长期手工维护入口。

## 4. 路由与视觉基线

根布局使用暗色 Stack；底部一级导航固定为：首页、训练、饮食、AI 教练、我的。选中态使用香槟钛金，未选中态使用灰色；页面背景和导航栏使用曜石黑及石墨灰层级。Token 只提供基础值，业务组件在后续功能中复用，不在页面散落主题色。

## 5. 验证

- `pnpm install`：安装 workspace 依赖并更新 `pnpm-lock.yaml`。
- `pnpm --filter @ridepilot/mobile exec expo config --json`：配置成功解析，SDK 57、暗色主题和 `expo-router` 插件生效。
- `pnpm --filter @ridepilot/mobile typecheck`：已执行并通过。
- `pnpm --filter @ridepilot/mobile lint`：已执行并通过 Expo flat ESLint。
- `pnpm --filter @ridepilot/mobile exec expo-doctor`：21/21 项检查通过。
- `pnpm --filter @ridepilot/mobile exec expo export --platform web`：Web bundle 成功导出。

## 6. 未实现与后续

- 登录注册、API Client、Query、状态管理和业务 Feature 均未加入。
- 底部导航页面目前是路由占位，不代表对应产品能力已实现。
- 原生模块、蓝牙、设备同步、通知和权限配置待具体需求确认后增加。

## 7. Phase 0 UI 基础设施

Phase 0 在本工程基础上增加 NativeWind 4、暗色主题映射、Safe Area 布局、通用 UI 组件、Lucide 图标和开发用 `/showcase` 路由。详细目录、组件 Props、Token 用法和验证命令见 [UI 基础架构文档](../frontend/ui-foundation.md)。本次仍未接入任何业务 API 或业务数据。
