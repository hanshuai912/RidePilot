# 训练历史

## 目的与范围

原“训练执行与周期复盘”调整为训练历史。页面只展示按日期倒序排列的课程列表，移除日期筛选、统计、复盘建议、测试依据、反馈录入和后续训练操作。入口迁到“我的”，位于“目标”下方、“第三方 App”上方；原训练页和 AI 教练的入口移除。

历史指账号时区截至今天的当前正式课程，以及已留有反馈的旧版原始课程。尚未记录的过去课程显示“未记录”，不推断完成状态；未来课程、未发布草稿、旧版中已被替换且没有记录的课程不显示。没有关联课程的独立活动不伪造课程详情，不纳入此课程列表。此前复盘的默认七天和 84 天范围不再限制历史列表。

## 页面与流程

1. 我的 → 训练历史，使用独立受保护路由 `/training-history`，隐藏底部 Tab 栏。
2. 最近日期在上，同一天按课程顺序展示；整行包含日期、课程名称、反馈状态及实际或计划时长。
3. 点击课程进入 `/workouts/[workoutId]?source=history`，以稳定课程 ID 加载该节课程，支持同日多节训练。详情展示结构化动作、执行功率快照及已有反馈，隐藏反馈、调整和编辑操作。返回仍回到历史；独立打开详情时返回历史页。
4. 首次加载 20 条，点击“加载更早训练”获取下一页。无记录显示空状态；首次失败可重试，加载更多失败保留已有列表和原游标，可重试同一页。重复点击不重复提交。
5. 页面聚焦重新读取；失焦、账户切换或刷新后，旧请求结果不再更新页面。长列表使用 FlatList。
6. 旧 `/coach/cycle-review` 链接重定向到新页，不恢复旧筛选或生成任务。

## 技术实现

- 共享契约：`packages/contracts/src/training-history.ts`，响应复用 `workoutSummarySchema`。
- 后端：`training-history.repository.ts` 负责用户隔离、候选课程与稳定身份去重、日期分页；`training-history.service.ts` 负责时区、游标校验、详情可见性和 DTO；由现有 TrainingController 提供接口。
- 移动端：`TrainingHistoryScreen`、`useTrainingHistory`、`TrainingHistoryRow` 分离页面、加载和行展示；复用 training API、黑金主题与现有课程详情。
- 多版本未修改课程沿用 `activityWorkoutId`，优先展示当前正式副本，不重复统计。已退出当前版本但有反馈的原始课程仍可查询其历史快照。
- 同一响应使用 Repeatable Read 只读事务，保证课程和反馈一致；游标为日期、同日顺序和 ID，不接受用户自行指定账号。跨页仍以当前数据为准，计划变化可能改变课程身份；重新进入会刷新列表。

## API 与权限

统一 `/api/v1` 前缀，要求本人 Access Token。

| Method | Path                           | 输入                  | 响应                                                    |
| ------ | ------------------------------ | --------------------- | ------------------------------------------------------- |
| GET    | `/workouts/history`            | 可选 `cursor`         | `{timezone,localDate,items,nextCursor}`，每页最多 20 条 |
| GET    | `/workouts/history/:workoutId` | 本人可见的历史课程 ID | `workoutSummarySchema`，`editable:false`                |

日期倒序，同日 `dayOrder`、`id` 升序；所有条件均在当前用户所属计划内查询。未登录 401；无效分页参数 400 `INVALID_HISTORY_CURSOR`；不存在、非本人、未来、未发布或不可见的历史课程统一返回 404 `WORKOUT_NOT_FOUND`。现有 `GET /workouts/:id` 和写接口继续只作用于当前正式版本，不放宽历史写权限。

无数据库迁移，无新依赖或技术选型；不写训练或活动数据，不改变草稿确认、版本、幂等与功率快照规则。

## 训练页同步精简

按同次任务要求移除“当日阶段测试”模块和测试明细入口；日历保留阶段测试日期标记及读取失败的重试，赛事和课程展示继续保留。

## 验证

- 后端 `test/training-history.e2e-spec.ts`：实际测试库验证时区日期、最近优先、同日顺序、跨版本去重、旧版有记录课程的详情、超过 84 天的分页、空数据、鉴权、归属、无效游标、未来及草稿不可访问。
- 移动端 `training-history.test.tsx`：无筛选汇总、日期列表、对应课程详情与只读操作、返回、分页失败重试与去重、重复点击、空数据、旧路由和零时长展示。
- 回归训练路由、AI 教练入口、旧草稿预览和“我的”列表排序；`training-routes.test.tsx` 验证日历保留测试标记，同时移除当日测试模块。
- 仓库根目录执行 `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`、`./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit` 和 `./node_modules/.bin/tsc -p apps/api/tsconfig.build.json`：共享契约构建、API 类型检查及构建通过；在 `apps/mobile` 执行 `./node_modules/.bin/tsc --noEmit`：通过。
- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/training/__tests__/training-history.test.tsx src/features/training/__tests__/training-routes.test.tsx src/features/coach/__tests__/cycle-review.test.tsx src/features/coach/__tests__/coach-center.test.tsx src/features/integrations/__tests__/third-party-apps.test.tsx`：5 组、80 项通过。
- 在 `apps/api` 执行 `node /tmp/ridepilot-training-history-integration.cjs`：临时运行器加载 `.env.test`，校验本地测试数据库与 Redis DB 1 后执行 `training-history.e2e-spec.ts` 和 `training.e2e-spec.ts`，2 组、17 项通过。未执行迁移。可通过现有 `pnpm --filter @ridepilot/api test:integration` 重新运行集成套件。
- 在 `apps/api` 执行 `./node_modules/.bin/jest --runInBand`：31 组、173 项通过；17 组、139 项集成测试按环境条件跳过，其中本次历史与原训练接口的 17 项已通过上述测试库运行器单独验证。
- 仓库根目录执行 `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`：通过；移动端改动文件 ESLint 通过。在 `apps/mobile` 执行 `./node_modules/.bin/expo lint`：初次受 pnpm 沙箱文件访问限制，经授权在沙箱外重跑通过。另一次直接 `eslint .` 误含已有 `dist` 生成包及测试配置文件而失败；以项目规定的 Expo lint 为源码门禁。
- 所有改动文件的 Prettier 检查及 `git diff --check HEAD` 通过。
- 在 `apps/mobile` 执行 `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-training-history-web --max-workers 2`：导出成功。

## 边界

本次不提供已移除的周期统计和复盘筛选，不补造历史计划或训练记录。未执行真机验收。

## 2026-11-13：按日组织训练历史

保留 FlatList 虚拟化、分页与刷新，同日只显示一次日期标题，课程改为紧凑行并继续区分实际与计划时长。完整范围、验证命令与验收边界见 [全局页面结构优化](global-ui-ux-structure.md)。
