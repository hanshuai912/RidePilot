# 全局排版与页面布局统一

更新时间：2026-11-12。

## 问题与范围

用户反馈不同页面文字忽大忽小、布局层级不清；进一步要求检查编辑课程及“训练动作”下每张动作卡。保留黑金主题、五栏导航、原有路由和业务流程。本轮不修改 API、数据库或计划应用规则，无数据库迁移。

排版通过 AppText、Button、Input、导航与集中 tokens 覆盖全部复用组件的页面；同时归并登录/注册、个人资料、设备连接、日期选择和训练表单的独立字体样式。源码审查保留的字号例外只有训练日历不可见兼容箭头（1 pt），不是可见文案。

## 统一规则

| 语义       | 字号 / 行高 | 字重 | 用法                 |
| ---------- | ----------- | ---- | -------------------- |
| 页面标题   | 28 / 34     | 600  | 五个主页面           |
| 内容主标题 | 22 / 28     | 600  | 引导问题、重要内容   |
| 分区标题   | 18 / 24     | 600  | 信息分组             |
| 导航标题   | 17 / 24     | 600  | 深层页面固定标题     |
| 卡片标题   | 16 / 22     | 600  | 列表主文案           |
| 正文、输入 | 16 / 24     | 400  | 主要内容、输入值     |
| 辅助说明   | 14 / 20     | 400  | 描述、解释、字段说明 |
| 短标签     | 13 / 18     | 500  | 状态、徽标、短元数据 |
| 按钮       | 16 / 22     | 600  | 主要、次要操作       |
| 关键数据   | 32 / 38     | 600  | 运动数值             |
| 图表与底栏 | 12 / 16     | 500  | 受限小字例外         |

页面边距 20，主页面顶部 12，模块间隔 24，卡片常规内边距 16 / 重点卡片 20。AppText 尺寸来自 `theme/typography.ts`，调用方 style 最后合并；明确传入的颜色和字重不再与默认 utility 同时竞争。Card 增加 none/default/roomy padding，调用方明确的 `p-*` 不叠加默认 `p-4`。

文字灰色提升为 `#939B91`；测试验证常规 primary/secondary/muted 在 background、surface1、surface2、surfaceElevated 上对比度至少 4.5:1。测试不代表所有半透明叠加、禁用态或图片底色均满足该阈值。

保留系统字体缩放。长按钮允许换行并随内容增长；隐私弹窗正文可滚动，关闭按钮保留在正文外。导航“保存”“生成”共用 44 pt 操作区，保持单行，最大缩放倍率 1.35；正文不限制倍率。Web 视口变小验证不等同 iOS Dynamic Type 或真实键盘验证。

## 页面布局

- 首页：统一 20 pt 边距，去掉标题下重复留白；训练主操作突出，次级按钮简写为“调整训练”“记录完成”，路由保持。
- 训练：标题不再叠加眉题，收拢底部空白；日历日期与安排分区保持原有语义。
- 饮食：页首副标题简化；补给联动收为摘要入口，原有待核对、错误重试和详细联动页保留；餐次编辑按钮不重复餐名，完整无障碍名称保留。
- 教练：页面标题与其他主页面对齐；指标至详情入口之间收紧间距。
- 我的：移除没有动作的齿轮装饰；资料卡去掉双层内边距，头像 48，给昵称与手机号更多空间；用真实体重替代技术版本号；训练能力与连接同步分组，原有入口不丢失。
- 个人信息、功率、心率和课程调整：顶部保存/生成共用单行操作组件，保留禁用、加载及防重复提交。
- 编辑课程：日期/草稿 → 课程信息 → 课程概览（分别汇总时间、距离）→ 训练动作 → 保存。原有保存、未保存保护、排序和草稿流程保留。

## 训练动作卡修正

用户在开发过程中多次反馈实际页面卡片仍错乱，因此单独处理卡片布局与拖动容器：

1. `WorkoutSegmentRow` 负责单张卡，列表与样式独立拆分；避免在整个课程编辑器堆叠布局逻辑。
2. 卡片顶行放拖动柄、名称和删除，目标与强度分行，编辑入口独占底行；删除、拖动与编辑各自保持至少 44 pt 区域。
3. 卡片撑满列表宽度，不设置固定内容高度；卡间距 12，强度说明可以折行，不被两侧图标挤压。
4. 列表通过 onLayout 获取实际宽度传给卡片；容器宽度、字体倍率、FTP 换算值或动作内容变化时重建 Sortable.Grid 的测量缓存；普通拖动排序保持同一容器，保留草稿数据与稳定动作 key。该项是对原生缓存尺寸风险的修正，不能据此认定已复现用户设备上的全部问题。
5. 关闭动作增删时的 entering/exiting 叠加动画，布局过渡仅用于 reorder，避免测量更新与增删动画同时改变坐标。原生与 Web 的默认增删动画不同，因此 Web 原先不能复现不能证明原生无问题。
6. 动作参数页的类型选择采用稳定 2×2 排列，输入框按底边对齐；目标值、组数、强度具有明确无障碍名称和选中状态。

实际用户设备上的最终显示尚需确认：目前可用环境只能执行组件测试与 Web 截图，未连接 iPhone/Android 真机。若用户继续看到错乱，需要实际画面与平台信息定位，不能以 Web 通过代替真机结论。

## 验证

所有命令从仓库根目录或注明的 mobile 目录执行；浏览器使用本地导出与合成 API 拦截，无真实业务写入。

- `apps/mobile/node_modules/.bin/tsc --noEmit`（在 apps/mobile）：通过。
- `apps/mobile/node_modules/.bin/eslint src app`（在 apps/mobile）：通过；清除了 CoachNextWorkoutCard 原有未使用图标警告。
- `apps/mobile/node_modules/.bin/jest --runInBand --json --outputFile=/tmp/ridepilot-ui-consistency-results.json`（在 apps/mobile）：主体改动后全量 49 套，47 套通过；410 测试通过、5 失败、10 跳过，总计 425。5 项失败已用修改前 HEAD 的独立 `/tmp/ridepilot-ui-baseline` 复现，同名同数量，不把全量结果记作全部通过。
- 既有失败：goal-planning 3 项（目标切换测试读取、时间线展开、内嵌阶段选择），coach-center 2 项（旧正式计划/版本刷新文案断言）。此次不改变这些业务行为来使旧断言通过。
- 新增共享测试验证实际字号/行高、显式样式与可访问性属性、按钮换行、输入一致性、顶部操作提交锁、颜色覆盖、Card 内边距覆盖及文字对比度；既有编辑、删除、排序与路由测试继续覆盖参数保留。
- `apps/mobile/node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-ui-consistency-web --max-workers 2`（在 apps/mobile）：通过。
- `node /tmp/ridepilot-ui-consistency-browser.cjs`：14 个登录后路由 × 320/390/430，另 3 个登录/注册/欢迎隐私弹窗在 320×568；主页面标题 28、深层导航 17，顶部动作水平且不小于 44，视口无横向溢出、无页面异常、无真实业务写入。直接访问 coach/planning 验证的是默认“调整训练”，赛后恢复另通过真实入口脚本验证。
- `node /tmp/ridepilot-editor-layout-final.cjs`：3 张动作卡，满宽、互不重叠、独立点击区，参数类型 2×2；修改重复组目标后返回保留，覆盖 320/390/430。
- `node /tmp/ridepilot-ui-check-workout-adjustment.cjs`：单课/后续范围、日期取消确认、范围确认、错误保留、不可编辑、缺少 FTP、重试通过。
- `node /tmp/ridepilot-ui-check-recovery.cjs`：真实赛后恢复入口、范围选择、错误保留和返回通过。
- `node /tmp/ridepilot-ui-check-profile-header-save.cjs`：3 个资料页 × 3 屏宽，保存单行、滚动固定、修改后启用通过。
- `node /tmp/ridepilot-ui-check-chat.cjs`：聊天布局、输入区锚定、合成发送/历史恢复、缩小视口通过。
- `node /tmp/ridepilot-ui-consistency-design-check.cjs`：14 个独立屏幕稿与五栏 Shadow DOM 原型的共享字号通过。

追加尺寸缓存修正后的定向检查和最终结果见本文末尾记录。临时截图与脚本位于 `/tmp`，未提交用户数据或截图资产。

## 设计资产与依据

已同步 UI 规范、`design/tokens/visual-system.json`、共享预览 CSS、当前独立页面稿、五栏原型构建器及编辑课程参考。历史流程帧作为既有版本保留。

参考 [Apple Typography](https://developer.apple.com/design/human-interface-guidelines/typography) 与 [Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) 的层级、可读性、缩放原则；本应用中文正文 16 是项目选择，不声称等同 Apple 默认字号。Sortable 尺寸行为同时核对本地 1.10.1 源码和[官方 Grid props](https://react-native-sortables-docs.vercel.app/grid/props)。

## 动作卡重叠的追加验证

用户明确现象为“卡片重叠或上下错位”。本轮追加了实际宽度传递、内容变化清除测量缓存、只为排序保留过渡的修正。

- `jest --runInBand src/features/training/__tests__/workout-drag-sort.test.tsx`：8 项通过；新增测量宽度变化、修改动作后 Grid 重新挂载、普通排序保持同一 Grid、草稿参数保留检查。
- 此前追加宽度修正后 `jest --runInBand src/features/training/__tests__/workout-drag-sort.test.tsx src/features/training/__tests__/workout-enhancements.test.tsx src/features/training/__tests__/training-routes.test.tsx`：3 套 56 项通过。
- 最终组合 `jest --runInBand src/features/training/__tests__/training-routes.test.tsx src/features/training/__tests__/workout-drag-sort.test.tsx src/features/training/__tests__/workout-enhancements.test.tsx src/components/ui/__tests__/typography.test.tsx`：4 套 65 项通过。
- `node /tmp/ridepilot-editor-mutations-final.cjs`：320/390/430 下三张卡满宽且互不重叠；编辑参数返回保留；添加新动作、保存并删除其他动作后，卡片仍保持 12 pt 间距，无真实业务写入。
- 最终 TypeScript、ESLint、Web export、双仓库 `git diff --check` 通过。真机渲染仍由用户运行环境确认。
- 浏览器鼠标/合成触摸拖动探测未能触发预期排序，之前的旧 Web 导出也出现相同结果，不能宣称真实手势验证通过；排序回调、稳定 key、无障碍排序和参数保存由组件测试覆盖。
