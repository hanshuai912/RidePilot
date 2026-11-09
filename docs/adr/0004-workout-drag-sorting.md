# ADR 0004：课程动作使用手柄拖拽排序

日期：2026-11-09。状态：采用。用户明确要求用图标拖拽替换点击上下箭头。

## 决策

采用 MIT 的 `react-native-sortables@1.10.1`，用单列 `Sortable.Grid` 与 `Sortable.Handle` 实现六点手柄拖拽。库的[安装文档](https://react-native-sortables-docs.vercel.app/getting-started)声明支持 Reanimated 3/4 和 Gesture Handler 2/3；[手柄](https://react-native-sortables-docs.vercel.app/helper-components/handle)限制拖动区域，[自动滚动](https://react-native-sortables-docs.vercel.app/grid/examples/auto-scroll)直接接入外层 Animated.ScrollView。适合已有的表单滚动页面，不引入嵌套 FlatList。

通过 Expo SDK 57 安装器安装 Gesture Handler `~2.32.0`，复用现有 Reanimated 4.5.1 / Worklets 0.10.1，根布局设置 GestureHandlerRootView。无需修改 native 目录。新增原生依赖后需重建开发包。

## 备选与取舍

调研过 [react-native-reorderable-list](https://github.com/omahili/react-native-reorderable-list)，其 FlatList 和嵌套滚动容器适合以列表为主的页面；本项目课程编辑包含名称、目的、结构图及合计表单，Sortables 与既有滚动页更直接匹配。自行编写手势和碰撞计算需要额外维护自动滚动与布局变化，当前已有库可满足需求。

Sortables 官方说明 Gesture Handler 2 在 iOS 新架构页面卸载/重新挂载场景存在已知手势风险，3 系列已修复。本任务保持 Expo 57 推荐的原生版本，并将 iOS 返回后再次拖动列入真机验收；不据类型或打包成功宣称手势已在设备通过。后续升级应随 Expo 原生依赖兼容性一起验证。

不启用可选触觉反馈。临时 UI key 不进入 API 数据；只在松手后更新草稿，正式发布仍需校验与确认。没有 API 或数据库变更。
