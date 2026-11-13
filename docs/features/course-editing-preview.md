# 课程编辑与差异预览

## 目的与流程

对应 PRD FR-007、FR-302、FR-305～308、FR-313。正式课程仍采用现有人工草稿校验与应用流程；AI 候选局部编辑只保存草稿，返回教练建议预览后重新校验、确认才发布。

- 根据 2026-11-09 用户确认的变更，所有课程编辑入口统一采用专业模式，展示结构图、动作目标、强度区间、重复次数及六点图标拖拽排序。
- 移除简洁/专业切换及简洁模式的整体比例调整；通过动作编辑逐项增删改、排序、设置目标及重复次数。距离动作保留原距离，不换算为确定时长。
- 不再读取或保存视图偏好；已有 SIMPLE / PROFESSIONAL 数据不影响编辑器。人工课程和 AI 候选复用同一个完整编辑器。变更优先于原 PRD 中的双视图要求，见 [需求变更记录](../changes/2026-11-09-professional-workout-editor.md)。
- AI 候选的每节课程均可局部编辑名称、目的和动作。保存只替换所选课程；其他候选、原课程快照和关联范围保留。无 FTP 时引导设置；未保存动作/课程离开时提示放弃。
- 单节预览列出原/新日期、时长、距离、动作数、目的、各动作目标、强度单位/区间、重复次数及结构图。
- 范围预览完整列出原安排和新安排，不把同一天的多节课程按日期强行配对。新生成草稿保存原动作明细；历史草稿缺少明细时明确提示。
- 调整表单可选“仅此课程”或“联动后续课程”。后者选择起止范围（原课程当天至结束日，最多 84 天）并二次确认，再使用现有范围生成接口。完整预览列出被替换课程；历史/已记录课程保留，阶段、测试与补给另行确认。

## 实现与接口

移动端：`Editor`、`WorkoutDiff`、`AiCandidateEditorScreen`、`WorkoutAdjustmentForm`，以及 `PlanPreview`。路由 `/workouts/candidate?proposalId=...&index=...` 只传稳定提案 ID 和课程序号。

| 接口                                    | 作用与约束                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `PATCH /ai-coach/proposals/:id`         | 复用草稿更新；expectedProposalVersion 乐观锁、归属校验；更新后 DRAFT 且清除旧校验 |
| `POST /plans/generate-range-proposal`   | 已确认范围生成草稿，未记录的正式课程才可替换                                      |
| `POST /proposals/:id/validate`、`apply` | 重新校验；应用传入预览版本，事务内再检查版本与领域约束                            |

移除专用视图偏好 API 和共享契约，历史数据库列仅保留兼容，无 migration。AI 草稿 JSON 的 `replacedWorkouts` 增加可选 `purpose/segments`，兼容已有数据。单节应用在校验响应版本变化时要求重新预览；不确定的应用响应沿用原幂等键重试。

## 验证

相关测试：移动端 `workout-enhancements.test.tsx`、`training-routes.test.tsx`；后端 `coach.e2e-spec.ts`、`training.e2e-spec.ts`。覆盖默认完整参数显示、无模式切换、排序保留重复次数与单位、范围确认、局部更新保留其他课程、冲突保留输入、归属及草稿版本。实际执行结果见 [本次验证记录](../testing/course-calendar-home-2026-11-09.md)。

V1 排序使用 `react-native-sortables` 的六点手柄长按拖拽，已移除上下箭头。只在松手且位置改变时更新草稿，结构图和编号随草稿顺序刷新；保存中、只读、单动作时不提供拖拽。读屏可通过手柄的调整操作排序。编辑保存失败保留输入；并发修改要求重新读取，防止覆盖其他端的草稿。

## 2026-11-09：图标拖拽排序

- 使用 `react-native-sortables@1.10.1` 单列 Grid 和独立 Handle，长按 180ms 激活；其余行内容保留滚动与编辑/删除交互。手柄触控范围至少 44×44。
- 动作行左侧为六点拖拽把手，中间整个内容区域（编号、类型、目标、强度及留白）点击进入动作编辑，右侧为独立删除按钮；移除三点编辑入口。三个交互区并排，删除及拖动不触发编辑，编辑和删除提供按压反馈。保存中及只读状态不提供这些操作；人工草稿与 AI 候选一致。
- `TrainingPage` 使用 `Animated.ScrollView` 并通过 `TrainingScrollContext` 提供引用，支持靠近页面边缘自动滚动；无需在滚动页面中嵌套虚拟列表。
- 根布局增加 `GestureHandlerRootView`，手势依赖使用 Expo SDK 57 安装器选择的 `react-native-gesture-handler@~2.32.0`，复用 Reanimated 4.5.1 和 Worklets 0.10.1。
- `useSortableSegments` 为每次本地动作出现分配唯一 UI key；相同内容、没有 ID 的新动作也可区分，排序不将索引或临时 ID 写入训练数据。
- API、数据库和发布流程不变；排序仅修改当前草稿，人工课程和 AI 候选共用此实现。
- 添加 NativeWind Babel 配置所需的直接开发依赖 `@babel/plugin-transform-react-jsx@^7.29.7`，避免 pnpm 隔离解析时找不到插件；保持 Babel 7 兼容。

库选择与兼容性见 [ADR 0004](../adr/0004-workout-drag-sorting.md)，运行命令和实测结果见 [拖拽验证](../testing/workout-drag-sorting-2026-11-09.md)。已有原生开发包需要重新构建以包含新增手势依赖，例如 mobile 目录运行 `pnpm android`；仅刷新 JS 无法加入原生模块。当前无设备连接，触控、长列表自动滚动和 iOS 页面重新进入仍需真机验收。

## 2026-11-12：训练动作卡片间距与对齐

- 动作卡片统一使用四周 16 pt 内边距，卡片之间保持 12 pt 间距，沿用页面两侧 20 pt 留白和现有黑金主题。
- 移除“编辑参数”行与右箭头。标题、时间或距离目标、强度及中间留白合成一个点击区域，点击直接进入动作编辑；左侧拖拽手柄、右侧删除按钮独立于编辑区域，避免嵌套按钮误触。单动作、只读和保存中没有手柄时不保留空列，触控区域至少 44×44 pt。
- 使用现有 spacing、layout、radii Token 统一尺寸。参数允许自然换行，卡片高度随内容变化，避免窄屏和大字体挤压。
- `WorkoutSegmentList` 独立测量动作区域，保留小数宽度，避免宽度向上取整后超出容器；忽略隐藏页面的零值与其他无效尺寸。宽度、内容或字体缩放变化仍重建拖拽测量，排序保留原有容器与草稿。
- 修改文件：`WorkoutSegmentList.tsx`、`WorkoutSegmentRow.tsx`、`workout-segment-list.styles.ts`、`workout-drag-sort.test.tsx`。人工课程与 AI 候选复用此布局，无 API、共享契约、数据库或依赖变更。

实际验证（命令除注明外在 `apps/mobile` 执行）：

- `./node_modules/.bin/jest --runInBand --silent --testTimeout=15000 src/features/training/__tests__/workout-drag-sort.test.tsx src/features/training/__tests__/workout-enhancements.test.tsx src/features/training/__tests__/training-routes.test.tsx`：3 suites、57 tests 通过；覆盖排序、编辑、删除、保存中禁用、错误与退出处理，并增加小数宽度、无效布局尺寸、无“编辑参数”行和每动作单一编辑入口的回归断言。
- `./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint src app`：通过。
- `node ./node_modules/expo/bin/cli export --platform web --output-dir /tmp/ridepilot-segment-layout-final --max-workers 2`：通过。
- 根目录 `node /tmp/ridepilot-segments-layout-check.cjs`：使用模拟 API 的 Chromium 页面验证 320 / 390 / 430 px 宽度和点击动作标题进入编辑后返回；检查卡片四周留白、12 px 间距、内容对齐、无“编辑参数”行、触控尺寸及文字边界。320 px 下将文字增大至 150% 后检查通过。截图位于 `/tmp/ridepilot-segments-fixed-{320,390,430}.png`、`/tmp/ridepilot-segments-fixed-large-text.png`。此浏览器检查不写入真实用户数据。
- 根目录 `node /tmp/ridepilot-segments-touch-check.cjs`：Chromium 触摸事件拖拽成功，拖动后添加、删除动作保持 12 px 间距；删至单动作和空列表仍可正常操作。
- 后端目录 `./node_modules/.bin/jest --runInBand --silent`：31 suites、173 tests 通过，18 suites、145 tests 跳过；未运行真实数据库集成测试。
- 根目录依次运行 `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json --noEmit`、`./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`、`./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`、`./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`、`./node_modules/.bin/tsc -p apps/api/tsconfig.build.json`：通过。

移动端全量命令 `./node_modules/.bin/jest --runInBand --silent --testTimeout=15000 --json --outputFile=/tmp/ridepilot-segments-final-results.json`：47 suites、412 tests 通过，10 tests 跳过，2 suites、5 tests 失败。失败为目标规划 `goal-planning.test.tsx` 的 3 项断言和教练中心 `coach-center.test.tsx` 的 2 项断言。将修改前的 HEAD 导出到 `/tmp/ridepilot-segments-baseline` 后运行这两个套件，复现相同 5 项失败（基线结果 `/tmp/ridepilot-segments-baseline-results.json`）；本次未扩大范围修改这些模块。变更文件 Prettier 检查与 `git diff --check` 通过。

未连接 Android/iOS 设备，原生页面实际布局、系统字体缩放、触控与边缘自动滚动仍需设备验收；浏览器放大文字不等同于系统字体缩放验证。
