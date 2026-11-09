# 动作拖拽排序验证

日期：2026-11-09。关联：[功能说明](../features/course-editing-preview.md)、[库选择](../adr/0004-workout-drag-sorting.md)。

## 实现覆盖

- 编辑器展示六点拖拽图标，无上下箭头；手柄长按激活，只有松手后发生位置变化才更新草稿。
- 跨多行移动后保存、编辑索引与显示编号保持一致；时间、距离、强度、重复次数及合计不变。
- 重复且未保存的动作有唯一稳定 UI key，排序不向 API 草稿写入临时 ID。
- 同位置、越界和非整数的结束位置不写入；保存中、只读列表、单动作不提供可用拖拽。
- 手柄提供读屏调整操作及边界限制；图表读取同一份更新后的草稿。
- 外层 TrainingPage 提供 Animated.ScrollView 引用用于边缘自动滚动，根布局包含 GestureHandlerRootView。

测试位于 `workout-drag-sort.test.tsx`、`workout-enhancements.test.tsx`、`training-routes.test.tsx`。Node 使用 Sortables 回调边界替身及 Reanimated mock，验证数据和交互连接；不等同于真实触控或原生滚动验收。Worklets 的 Jest resolver 只匹配实际包目录，避免 pnpm 含 peer 名的目录误把 Expo 原生入口替换为平台无关占位实现。

## 实际命令

在 mobile 目录执行：

- `node ./node_modules/expo/bin/cli install react-native-gesture-handler react-native-sortables --pnpm`：安装 Sortables 1.10.1 与 Expo 57 推荐的 Gesture Handler 2.32.0。
- `node ./node_modules/expo/bin/cli install --dev @babel/plugin-transform-react-jsx@^7.29.7 --pnpm`：补全 NativeWind Babel 的直接插件解析依赖，保持 Babel 7 兼容。
- `./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint src app`。
- `./node_modules/.bin/jest --runInBand --silent --testTimeout=15000`：全量回归。
- `node ./node_modules/expo/bin/cli export --platform android --output-dir /tmp/ridepilot-drag-android --max-workers 2`：Android JS 打包。
- `node ./node_modules/expo/bin/cli install --check`：Expo 依赖兼容检查。
- 根目录 Prettier 检查和 `git diff --check`。

最初未设置 Worklets Jest 解析器时触发 Node 原生运行时错误，已修复测试环境。默认 5 秒定向运行中，原有多步骤范围确认测试超时；拖拽 5 项和训练路由 44 项通过。最终全量运行显式使用 15 秒等待限制，保留全部断言。

安装器的 peer 检查仍报告既有 `react-reconciler@0.34.0` 要求 React `^19.3.0`，仓库现有 React 为 19.2.3；本次未改动这些版本。

## 已完成结果

- TypeScript 与 ESLint 通过。
- 最终移动端全量回归 35 suites、316 tests 全部通过，耗时 105.352 秒。日志 `/tmp/ridepilot-drag-full.log`。
- 本次修改的源码、测试和文档 Prettier 检查通过，`git diff --check` 通过。
- Android JS export 成功，产物位于 `/tmp/ridepilot-drag-android`；这不是原生 APK 构建或设备手势验收。
- Expo 依赖检查返回非零：现有 Expo 57.0.27、Constants 57.0.21、Linking 57.0.12、Router 57.0.25 分别有推荐补丁 57.0.32、57.0.23、57.0.13、57.0.30。本任务未升级这些既有依赖；新手势依赖采用安装器推荐版本。

## 设备验收

`adb devices` 当前无连接设备，未执行 Android/iOS 实机拖动、长列表边缘滚动、iOS 返回页面再次拖动或读屏验收。新增手势原生依赖后须重新构建开发包，例如 mobile 目录 `pnpm android`，不能只刷新 JS。

手工检查：从六点图标长按拖动首/尾和重复动作；拖到屏幕上下边缘观察滚动；松手后编辑目标动作并保存、重新读取；AI 候选保存草稿后确认其他课程保持原样；保存中不可拖动，退出未保存草稿仍需确认。

## 动作行布局调整

左侧六点把手、中间整块内容点击编辑、右侧独立删除；移除三点入口。沿用黑金主题和至少 44×44 的图标触控范围。把手、内容按钮和删除按钮并排，避免嵌套按钮触发编辑。

本次在 `apps/mobile` 实际执行：

- `./node_modules/.bin/jest --runInBand --silent --testTimeout=15000 src/features/training/__tests__/workout-drag-sort.test.tsx src/features/training/__tests__/workout-enhancements.test.tsx src/features/training/__tests__/training-routes.test.tsx`：3 suites、54 tests 通过。
- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/eslint src app`：通过。
- 根目录对本次修改的组件、测试、功能文档和本验证记录运行 Prettier 检查，并执行 `git diff --check`：通过。

新增断言覆盖点击标题、目标及强度均进入对应动作编辑；删除只触发删除，排序结束不触发编辑；排序后编辑索引正确；保存中及只读状态无编辑/删除入口。Jest 使用手势替身，实际触摸和布局仍需真机检查。本次只修改 JavaScript 界面，已安装上一份包含手势库的开发包可连接 Metro 刷新查看，无需重新构建原生 APK。
