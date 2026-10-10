# React Native UI 基础架构

## 1. 本次完成内容

Phase 0 只建立移动端 UI 基础设施，不包含训练、饮食、赛事、目标、AI、API 或业务数据。

- Expo SDK 57 + Expo Router 基础工程
- NativeWind 4.2.7 + Tailwind CSS 3 暗色主题映射
- Safe Area Provider、暗色 StatusBar、统一页面容器和 Header
- 五个底部导航占位页：首页、训练、饮食、AI 教练、我的
- 基础 UI 组件：AppText、Button、Card、Input、Textarea、Badge、Separator、Checkbox、Switch、Tabs、Dialog、Skeleton、Spinner
- Lucide React Native 图标基础接入
- 开发用 UI Showcase 路由
- 保留 Config Plugins、Expo Modules 和 Development Build 的后续扩展边界

## 2. 项目目录

```text
apps/mobile/
├── src/
│   ├── app/                         # Expo Router 路由
│   │   ├── _layout.tsx              # SafeArea、StatusBar、Root Stack
│   │   ├── showcase.tsx             # 开发用组件预览
│   │   └── (tabs)/                  # 一级底部导航
│   ├── components/
│   │   ├── layout/                  # Screen、PageHeader、占位页
│   │   └── ui/                      # 可复用基础组件
│   ├── lib/cn.ts                    # NativeWind className 合并
│   └── theme/                       # TypeScript Design Tokens
├── assets/
├── global.css                      # Tailwind 指令
├── tailwind.config.js              # NativeWind 主题映射
├── babel.config.js                 # NativeWind Babel preset
├── metro.config.js                 # NativeWind Metro wrapper
├── app.config.ts                   # Expo 动态配置与 Config Plugin
└── nativewind-env.d.ts             # className 类型声明
```

路由继续使用当前仓库的 `src/app` 结构，没有重复创建平行的 `app/` 目录。

## 3. 技术栈与依赖版本

| 依赖                     | 版本       | 用途                                        |
| ------------------------ | ---------- | ------------------------------------------- |
| Expo                     | `~57.0.27` | React Native 工程和构建                     |
| Expo Router              | `~57.0.25` | 文件路由                                    |
| React Native             | `0.86.3`   | 移动端运行时                                |
| NativeWind               | `4.2.7`    | Tailwind className 到 React Native 样式映射 |
| Tailwind CSS             | `3.4.19`   | Token 和 utility class 配置                 |
| react-native-css-interop | `0.2.7`    | NativeWind 运行时 peer 依赖                 |
| Reanimated               | `4.5.1`    | NativeWind 和后续动效基础                   |
| Worklets                 | `0.10.1`   | Reanimated 4 peer 依赖                      |
| Lucide React Native      | `1.53.0`   | 线性图标                                    |
| react-native-svg         | `15.15.4`  | Lucide peer 依赖                            |
| Safe Area Context        | `~5.7.0`   | 安全区域适配                                |

`react` 与 `react-dom` 均固定为 `19.2.3`，保证 Web 运行时版本一致。

## 4. Design Tokens

TypeScript Token 位于 `apps/mobile/src/theme/`：

- `colors.ts`：背景、表面、边框、品牌金、文本和状态色
- `typography.ts`：Display、Title、Section、Card、Body、Caption、Label
- `spacing.ts`：4/8 栅格间距和页面边距
- `radius.ts`：小、中、卡片和胶囊圆角
- `layout.ts`：触控最小尺寸、按钮高度、内容最大宽度
- `index.ts`：统一导出 `darkTheme`

NativeWind Token 位于 `tailwind.config.js`，使用相同的颜色语义名称，例如 `bg-background`、`bg-surface`、`text-primary`、`text-secondary`、`text-brand`。

组件中优先使用 utility class 或 TypeScript Token；新增组件不要散落新的主题色、间距和圆角值。

## 5. 基础组件与 Props

| 组件        | 主要 Props                                                        |
| ----------- | ----------------------------------------------------------------- |
| `AppText`   | `variant`、`muted`、`className`、TextProps                        |
| `Button`    | `variant`、`size`、`loading`、`disabled`、`className`、`children` |
| `Card`      | `className`、ViewProps                                            |
| `Input`     | TextInputProps、`className`                                       |
| `Textarea`  | InputProps，默认多行和最小高度                                    |
| `Badge`     | `variant`、`className`、`children`                                |
| `Separator` | `className`、ViewProps                                            |
| `Checkbox`  | `checked`、`onCheckedChange`、`disabled`                          |
| `Switch`    | `value`、`onValueChange`、`disabled`                              |
| `Tabs`      | `options`、`value`、`onValueChange`                               |
| `Dialog`    | `visible`、`title`、`description`、`onClose`、`children`          |
| `Skeleton`  | `className`                                                       |
| `Spinner`   | `size`                                                            |

组件位于 `src/components/ui/`，按 React Native Reusables 的小组件、组合式 Props 和 NativeWind className 方式组织；当前不引入未使用的复杂组件库实现。

## 6. 如何新增通用 UI 组件

1. 先确认组件确实跨业务域复用。
2. 在 `src/components/ui/` 创建单职责组件和 Props 类型。
3. 颜色、尺寸、间距优先使用 Tailwind Token 或 `src/theme/` Token。
4. 支持必要的禁用、加载、空值或错误状态。
5. 在 `src/components/ui/index.ts` 暴露组件。
6. 在 `/showcase` 增加一个最小展示状态。
7. 执行移动端 typecheck、lint 和 Web export。

## 7. 如何添加新页面

Expo Router 页面放在 `src/app/`。页面只负责装配布局和组件；可复用 UI 放在 `components/`，跨页面逻辑放在 `hooks/` 或 `lib/`。

- 一级页面放入 `src/app/(tabs)/`，并在 Tabs Layout 注册。
- 详情或编辑页面放在 `src/app/` 对应路由下，不加入底部导航。
- 使用 `Screen` 处理 Safe Area、背景和滚动。
- 使用 `PageHeader` 保持标题和副标题层级一致。
- 暂无业务数据时使用明确占位状态，不制造训练或营养数据。

## 8. 如何使用统一主题

NativeWind 示例：

```tsx
<View className="rounded-card border border-border bg-surface p-4">
  <AppText variant="section" className="text-brand">
    标题
  </AppText>
</View>
```

需要 JS 数值或原生 API 时，从 `src/theme` 导入 Token：

```tsx
import { colors, spacing } from "../theme";

const separatorStyle = {
  backgroundColor: colors.divider,
  marginTop: spacing.lg,
};
```

V1 只支持暗色主题，暂不维护浅色 Token。

## 9. UI Showcase

开发环境直接访问：

```text
/showcase
```

例如 Web 地址为 `http://localhost:8081/showcase`。Showcase 不属于底部导航，展示按钮、表单、卡片、徽标、Tabs、Dialog、加载状态、字体层级和颜色 Token。

## 10. 本地启动与调试

```bash
cd apps/mobile
pnpm install
pnpm start
npm run web -- --clear
```

常用检查：

```bash
pnpm --filter @ridepilot/mobile typecheck
pnpm --filter @ridepilot/mobile lint
npx expo-doctor
pnpm --filter @ridepilot/mobile exec expo export --platform web
```

修改 `global.css`、Tailwind、Babel 或 Metro 配置后，需要使用 `--clear` 重启 Metro。新增原生依赖后使用 Development Build 验证，不手动维护生成的 `ios/` 和 `android/` 目录。

## 11. 已验证内容、已知问题和后续建议

已验证：

- TypeScript 类型检查通过
- ESLint 检查通过
- Expo Doctor 21/21 检查通过
- Web bundle 成功导出，包含 NativeWind CSS
- Expo Router 识别 `src/app` 路由和 `/showcase`

已知边界：

- 五个底部页面仍是 UI 占位页，不代表业务功能已实现。
- Showcase 当前为可访问开发路由，后续可在生产构建中通过路由策略隐藏。
- Reanimated 已作为 NativeWind 依赖安装，尚未添加业务动画。

后续建议：先在此基础上确定页面级组件规范，再按纵向业务闭环接入 API 和状态管理，避免在 UI 基础层提前加入业务逻辑。
