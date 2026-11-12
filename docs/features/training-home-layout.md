# 训练页布局与无课程状态

## 页面目标与设计依据

用户从底部“训练”进入，先选择日期，再查看对应课程或赛事；无课程时能够理解当前状态并添加课程。一级五栏导航与课程详情、编辑、AI 草稿预览及确认流程保持原有行为。

本次以 `RidePilot_UI/AGENTS.md`、`RidePilot_UI/references/home-reference.png` 为视觉依据，以 `RidePilot_Product/PRD.md` FR-202、FR-207、FR-810 及本次用户要求为业务依据。仅使用现有曜石黑、石墨灰、香槟金主题、字体、间距与圆角 token，不增加摄影、插画或新的全局主题。

## 信息架构与交互

从上到下：

1. 页面标题与刷新按钮。
2. 一张训练日历卡片：周/月切换、日期范围及前后翻页、星期、日期与事件标记、图例、训练安排核对入口。
3. 所选日期分区：“今日安排”或“训练安排”、日期、星期和实际课程数量；选中其他日期时提供“回到今天”。
4. 当日赛事和课程；没有课程时展示缺省卡片。
5. 当前和未来日期，底部统一提供低权重“添加计划”，休息卡片中不重复放置主按钮。

“资料变更与未来训练”不再是列表末尾独立大卡和大按钮，改为日历内以细分隔线划分的“训练安排核对”整行入口。没有待核对项时用简短说明；有数据时显示真实的“X 节未来课程待核对”，仅数量与图标适度用金色强调。加载与失败明确显示状态，不将失败当作零项或“已同步”。点击仍进入 `/plans/input-impact`，不直接调整正式训练。

日历选中日期使用金底，今天有独立下划线；课程、比赛、测试、休息、恢复同时使用不同形状、颜色、图例与读屏文字，不只依赖颜色区分。月视图显示固定星期行，不在每个日期内重复星期和长事件文字。多类事件同时出现时保留各自标记。

课程卡片内容区整块可点击，右侧箭头提示进入详情；不再展示“查看课程”和“课程改期”按钮。底部只保留等宽、52 pt 的“调整今天”（未来日期为“AI 调整”）和“编辑动作”。内容区与操作区分开，点击动作按钮不会同时打开详情。历史、锁定或已有反馈课程只保留卡片详情入口，隐藏不可用的操作。原改期独立页面和后台能力保留，本次仅移除训练卡片入口。

## 状态定义

| 状态                      | 表达与操作                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------ |
| 当前/未来日期没有安排训练 | 月亮图标、横向紧凑“休息日”卡片和说明；卡片下方提供次级“添加计划”                     |
| 历史日期没有安排训练      | 同样显示“休息日”，不提供创建历史课程的按钮                                           |
| 已设置的固定休息日        | 与其他无训练日期采用相同样式，不再区分“未安排”和“固定休息”                           |
| 读取中                    | 加载指示与“正在读取训练安排…”；不显示休息日卡片或推断休息标记                        |
| 日历失败                  | 明确标题、实际失败信息、“重新加载训练安排”；不将失败数据当作休息日                   |
| 资料核对失败              | 行内说明进入后可重试，入口继续可用；刷新日历也刷新核对状态                           |
| 有课程                    | 原有结构图、参数、详情、编辑、调整及改期权限继续使用同一份正式课程数据               |
| 有赛事/测试/恢复安排      | 保留相应日程及标记，不叠加休息提示；测试仍只保留日历标记，不恢复已移除的当日测试模块 |

日历范围没有课程不等于没有正式计划，本次不以空日历推断账户状态，不虚构课程、完成情况或健康结论。

## 实现与数据边界

- `Home.tsx`：训练页信息架构与日期分区。
- `TrainingCalendarGrid.tsx`、`TrainingCalendarMarker.tsx`：日历布局、事件形状与图例；`training-calendar.styles.ts` 维护局部样式。
- `TrainingDayState.tsx`：加载、失败及统一休息日展示；`ScheduledWorkoutCard.tsx`：从原页面抽出已有课程卡片。
- `training-home.styles.ts`：分组间距、144 pt 最小高度的横向休息卡、56 pt 圆形月亮图标与次级添加入口。
- `calendar-day.ts`：共享日期展示规则；在日程读取成功后，没有训练课程、比赛、测试或恢复安排的日期显示休息。此为训练页展示规则，不向后端写入休息事件，不声称实际完成了休息或身体恢复。
- `PlanImpactEntryCard.tsx`：复用原鉴权预览接口及失焦清理，新增日历刷新信号；旧请求不会在失焦或刷新后覆盖最新状态。
- `TrainingScreen.tsx`：继续读取日历、测试和赛事，将核对入口放入日历、赛事放入当日分区。

无 API、共享契约、数据库、依赖或原生工程变更。只读状态查询不写业务数据，所有课程创建和调整仍走原草稿、校验、预览及确认流程。

## 验证

`training-home-layout.test.tsx` 覆盖：休息日仅一个创建入口、所选日期传递、资料核对位置与跳转、历史日期及回到今天、无课程与固定休息日统一展示、加载/失败不伪装休息、重试、核对状态刷新、当日赛事分组与详情跳转。

`scheduled-workout-card.test.tsx` 验证点击卡片进入详情、仅保留两项操作、操作不触发详情，以及历史、锁定、已有反馈课程仅能查看。月历回归验证没有训练的日期统一标休息，比赛/测试继续保留原事件。

回归 `training-routes.test.tsx`、`workout-enhancements.test.tsx`、`workout-profile.test.tsx` 和 `plan-impact.test.tsx`，验证日期切换、月历、课程操作、结构图和原资料影响确认流程。

2026-11-11 初版布局验证（下方“休息日与按钮布局”记录后续修改的验证）：

- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/training/__tests__/training-home-layout.test.tsx src/features/training/__tests__/training-routes.test.tsx src/features/training/__tests__/workout-enhancements.test.tsx src/features/training/__tests__/workout-profile.test.tsx src/features/plan-impact/__tests__/plan-impact.test.tsx`：5 组、74 项通过。
- 在 `apps/mobile` 执行 `./node_modules/.bin/tsc --noEmit`，以及上述组件、样式、页面及测试文件的 `./node_modules/.bin/eslint`：通过，无警告。
- 在 `apps/mobile` 执行 `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-training-layout-web --max-workers 2`：Web 导出成功。
- 执行 `node /tmp/ridepilot-training-layout-review.cjs`：使用模拟 API、真实导出页面和 Headless Chrome，320/390/430 px 下验证无课、正常课程、待核对、月历、休息、错误/重试，核对入口位于日历内、单个空状态创建操作高 52 px、“回到今天”可用、无横向溢出或运行时异常、课程及添加入口滚动后不被底栏遮挡；未提交业务写请求。
- 截图保存在 `/tmp/ridepilot-training-empty-{320,390,430}.png`、`/tmp/ridepilot-training-course-{320,390,430}.png`、`/tmp/ridepilot-training-course-actions-{320,390,430}.png`、`/tmp/ridepilot-training-month-{320,390,430}.png`，以及 `/tmp/ridepilot-training-rest-390.png`、`/tmp/ridepilot-training-error-390.png`。这是真实 Web UI 配合模拟数据的验收，不代表真实账户或真机数据。
- 改动文件 Prettier 检查与 `git diff --check` 通过。本次没有后端改动，未重复执行后端套件；真机触控、动态字号与系统安全区验收尚未执行。

### 休息日与按钮布局

用户明确要求：没有安排训练的日期显示为休息日，并拆开课程卡片中过于集中的按钮。训练页统一使用休息卡片与日历休息标记；仅成功读取日程后推导此显示状态，事件日保留对应事件，不新增数据库记录或恢复已移除的测试模块。

- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/training/__tests__/training-home-layout.test.tsx src/features/training/__tests__/training-routes.test.tsx src/features/training/__tests__/workout-enhancements.test.tsx src/features/training/__tests__/scheduled-workout-card.test.tsx`：4 组、59 项通过。
- 在 `apps/mobile` 执行 `./node_modules/.bin/tsc --noEmit` 及相关 9 个改动源码/测试文件的 `./node_modules/.bin/eslint`：通过，无警告。
- 在 `apps/mobile` 执行 `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-rest-day-web --max-workers 2`：Web 导出通过。

### 课程卡片操作精简

2026-11-11 按用户最新要求，移除“查看课程”按钮，点击课程卡片内容查看详情；移除“课程改期”，仅保留调整和编辑动作。详情入口和底部操作使用同级 Pressable，避免嵌套交互及读屏聚合隐藏按钮；课程结构图、时长和权限规则保持原有实现。

- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/training/__tests__/scheduled-workout-card.test.tsx src/features/training/__tests__/training-routes.test.tsx src/features/training/__tests__/training-home-layout.test.tsx src/features/training/__tests__/workout-enhancements.test.tsx`：4 组、59 项通过，含点击课程卡片打开准确详情及原编辑流程回归。
- 在 `apps/mobile` 执行 `./node_modules/.bin/tsc --noEmit` 和相关 6 个源码/测试文件的 `./node_modules/.bin/eslint`：通过。
- `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-rest-day-web --max-workers 2`：通过。
- `node /tmp/ridepilot-rest-day-review.cjs`：模拟 API 的真实 Web 页面在 320/390/430 px 下通过；断言原查看、改期按钮消失、卡片详情入口可访问、调整与编辑同行且均至少 52 px、不重叠、无横向溢出。休息日、月历、错误重试及底栏避让继续通过。截图 `/tmp/ridepilot-rest-day-course-actions-{320,390,430}.png`。
- 改动文件 Prettier 与 `git diff --check` 通过；未执行真机验收。无接口或数据库变更。
