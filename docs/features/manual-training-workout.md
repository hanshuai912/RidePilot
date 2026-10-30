# 手动训练课程

## 1. 目的与范围

实现人工创建和编辑结构化骑行课程的 API 闭环。课程由热身、训练、恢复、放松动作组成；本期不包含 AI、GPS 路线、训练完成记录和营养联动。

关联 PRD：M03 FR-207～FR-211、M04 FR-311～FR-315。

## 2. 用户流程

1. 用户可以直接人工创建当天或未来课程，无需预先创建正式训练计划。
2. 用户编辑动作后点击“保存当天课程”，该点击即确认将人工课程保存到正式计划。
3. 客户端自动保存内部草稿、调用服务端校验动作、FTP 强度和目标汇总，再调用应用接口；无需跳转校验页或再次确认。
4. 应用接口在事务中检查计划版本并原子提交：没有正式计划时创建 `ACTIVE` 人工训练计划及第 1 版；已有计划时生成下一版。成功显示“保存成功”并返回刷新后的训练日历；失败留在编辑页、显示原因并保留填写内容。
5. 当天或未来课程可创建编辑提案；历史日期课程拒绝编辑。

无正式计划的草稿使用 `baseVersionId = null`、`basePlanVersion = 0`，读取、更新和校验均保留此语义。应用请求携带 `expectedBaseVersion: 0`。草稿中的课程摘要使用第 1 版作为首次发布版本；正式课程版本始终为正整数。

## 3. 技术实现

- 后端：`apps/api/src/modules/training/`
- `training.service.ts` 处理草稿与查询，`training-application.service.ts` 处理确认应用事务，`training.mapper.ts` 转换响应。
- 共享契约：`packages/contracts/src/training.ts`
- 数据：`TrainingPlan`、`PlanVersion`、`Workout`、`PlanItem`、`ChangeProposal`、`AbilityMeasurement`
- 课程结构保存在 `Workout.structure` JSON 中，时间和距离目标单独汇总。

## 4. API 契约

| Method | Path                                        | 说明                      |
| ------ | ------------------------------------------- | ------------------------- |
| POST   | `/api/v1/workouts/manual-proposals`         | 创建手动课程草稿          |
| POST   | `/api/v1/workouts/:workoutId/edit-proposal` | 创建当天/未来课程编辑草稿 |
| GET    | `/api/v1/proposals/:proposalId`             | 查询提案                  |
| PATCH  | `/api/v1/proposals/:proposalId`             | 保存草稿动作              |
| POST   | `/api/v1/proposals/:proposalId/validate`    | 校验提案                  |
| POST   | `/api/v1/proposals/:proposalId/apply`       | 幂等应用并创建新计划版本  |
| GET    | `/api/v1/calendar?from=&to=`                | 查询当前正式版本课程      |
| GET    | `/api/v1/workouts/:workoutId`               | 查询课程详情              |

所有接口均要求当前用户认证和资源归属校验。

## 5. 数据与迁移

迁移：`apps/api/prisma/migrations/20261022000000_training_manual_workouts/`；追加 `20261022010000_allow_initial_manual_plan` 将草稿基础版本改为可空，兼容已应用的旧迁移。数据说明见 [训练计划数据](../data/training.md)。

应用提案时在事务中复制基础版本、写入新课程和日历项目、切换 `activeVersionId`、记录应用结果。`Idempotency-Key` 防止重复应用。

首次应用在同一事务中创建正式计划、第 1 版、课程和日历项目。事务锁定当前用户行，串行处理同一用户的计划发布；同一提案并发重试返回同一版本，不同首次提案并发应用仅一份成功，另一份返回版本冲突。日历和课程详情只读取 `activeVersion`，不重复展示历史版本副本；编辑课程保留当天顺序。

## 6. 错误与边界

- 无正式计划：允许创建草稿并确认发布；仅保存或校验草稿时日历仍为空
- 历史课程：`HISTORICAL_WORKOUT_NOT_EDITABLE`
- 版本过期：`PLAN_VERSION_CONFLICT`
- 无 FTP 使用 `%FTP`：`FTP_NOT_AVAILABLE`
- 空动作或非法强度：`VALIDATION_FAILED` / 具体错误码
- 未校验草稿：`PROPOSAL_NOT_READY`；已应用草稿禁止重新编辑或校验
- 幂等键被其他提案使用：`IDEMPOTENCY_KEY_CONFLICT`
- 确认时重新检查日期与 FTP，过期或不再合法时整笔应用失败
- 已完成训练记录不因计划编辑而改变

## 7. 测试与验证

测试文件：`apps/api/test/training.validation.e2e-spec.ts`（目标汇总和输入边界）、`apps/api/test/training.e2e-spec.ts`（真实 PostgreSQL/HTTP 回归）。后者覆盖首次保存、读取/修改/校验、确认创建第 1 版、并发重试、不同草稿并发冲突、后续新增/编辑、旧版本隐藏、鉴权和用户隔离、错误版本、FTP 失效和应用后状态保护。

## 8. 移动端接入

移动端训练功能位于 `apps/mobile/src/features/training/`，覆盖日期选择、手动课程编辑、动作添加/编辑/删除、一键保存正式课程和正式课程详情。内部仍执行草稿保存、服务端校验和原子应用，人工课程不再要求单独预览或二次确认。日历同时展示已应用的 AI 课程，并按 `source` 标记来源；AI 草稿生成与确认位于 AI 教练 Tab。

移动端通过共享契约调用训练 API，不直接访问数据库。日历响应额外返回 `ftpAvailable`，用于在动作表单中禁用或启用 `%FTP`；编辑已有课程使用课程返回的 `planVersion` 作为 `expectedPlanVersion`，应用时携带幂等键并遵守版本冲突检查。

### 课程路由与草稿生命周期

训练页已由本地 `view/setView` 条件切换改为 Expo Router Stack 导航。底部训练 Tab 仅显示日历；二级页面在根 Stack 的受登录保护的 `workouts` 路由中展示，不显示底部 Tab。

| 路由                                           | 用途与参数                                                     |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `/training?date=YYYY-MM-DD`                    | 训练日历，可定位到 AI 应用响应中的课程日期；重新聚焦时刷新 API |
| `/workouts/new?date=YYYY-MM-DD`                | 新建课程，校验日期并加载当天已有课程                           |
| `/workouts/[workoutId]`                        | 课程详情，按 ID 调用 API，不依赖日历内存数据                   |
| `/workouts/editor?workoutId=...`               | 编辑正式课程，按 ID 加载版本和动作                             |
| `/workouts/editor?draftId=...&proposalId=...`  | 新建或继续编辑草稿；保存后补充服务端草稿 ID                    |
| `/workouts/segment?draftId=...&index=...`      | 添加/编辑动作，省略 index 时添加                               |
| `/workouts/preview?draftId=...&proposalId=...` | 保留用于旧草稿链接兼容；正常人工保存不再跳转                   |

`app/workouts/` 仅装配路由和 Stack；`features/training/screens/` 为独立页面；展示组件、API 与业务 hooks 分开。路由参数只传 ID、日期和动作序号，不序列化整份课程。

训练日历切换周次时同步移动选中日期，避免课程已加载却仍显示上一周的空日期。AI 教练应用成功后使用 `affectedDates` 中的首个日期打开日历，直接显示已发布课程。

`TrainingDraftProvider` 位于课程 Stack 内，按登录用户隔离，只保存当前编辑流程的临时草稿。课程编辑页、动作编辑页、预览页之间通过系统返回和手势返回时保留课程草稿。未保存课程返回时提示确认；未保存动作返回时提示确认放弃。已保存的草稿可通过 `GET /proposals/:proposalId` 恢复。未保存本地草稿在刷新或退出课程流程后失效，显示明确提示与返回入口。

人工课程点击保存后由 `services/save-manual-workout.ts` 顺序编排创建/更新草稿、校验、正式应用。全过程在编辑页显示保存中，禁用表单和重复提交，拦截保存期间的导航离开。任一步失败都停留编辑页并显示错误，只有应用接口成功才能退出整个课程 Stack、提示“保存成功”并刷新日历。详情动作列表只读，实际编辑必须进入编辑路由。

每次草稿/校验成功都保存返回的 proposalId、proposalVersion 和状态；后续重试复用同一草稿。校验阻断时不调用应用接口；修正动作后更新原草稿并重新校验。若应用超时且内容未改，重试直接调用带相同幂等键的应用接口，不重新编辑/校验可能已发布的提案；若超时后用户又修改内容，先读取原提案，已应用则明确提示重新打开课程修改并保留当前内容，防止静默丢弃修改。

此精简流程仅适用于人工课程，“保存当天课程”即用户确认。AI 计划仍需预览和明确确认。2026-10-27 起，正式课程详情额外提供训练反馈记录和单节 AI 调整入口；AI 调整仍复用异步生成、提案预览、服务端校验和原子应用，不改变人工课程保存语义。API 和数据库契约沿用现有实现，无新增表或迁移。Web API 跨域允许 `Idempotency-Key` 请求头以支持应用请求。

新增路由测试：`apps/mobile/src/features/training/__tests__/training-routes.test.tsx`，使用真实 Expo Router 测试容器验证导航、返回栈、表单保留、未保存提示、草稿恢复、失败重试和非法日期。API 调用在测试中 mock，不替代真实设备联调。

验证命令：

- `tsc -p packages/contracts/tsconfig.json --noEmit`
- `tsc -p apps/api/tsconfig.json --noEmit`
- `apps/mobile` 下执行 `tsc --noEmit`、`eslint src/features/training app/(tabs)/training.tsx`
- `apps/mobile` 下执行 `jest --runInBand`
- `apps/api` 下执行 `jest --runInBand test/training.validation.e2e-spec.ts`

### 2026-10-22 首次人工计划修复验证

- `pnpm install --frozen-lockfile`：通过，依赖与锁文件一致。
- `pnpm db:generate`、`pnpm db:validate`：通过。
- `pnpm typecheck`、`pnpm lint`、`pnpm build`：全部通过。
- `pnpm --filter @ridepilot/api test:integration`：本地独立 `ridepilot_test` 库迁移成功，8 个测试套件、38 项测试全部通过（包括 7 项训练 API 集成场景）。
- `pnpm --filter @ridepilot/mobile test`：7 个测试套件、15 项测试全部通过。
- `pnpm --filter @ridepilot/api db:deploy`：本机 `ridepilot` 开发库成功应用 `20261022010000_allow_initial_manual_plan`，未删除数据。
- 本次修改文件执行 Prettier 检查及 `git diff --check`。未执行真机交互验收。

### 2026-10-22 移动端课程路由改造验证

以下命令在 `apps/mobile` 下实际执行：

- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/expo lint`：通过。首次在沙箱内因 pnpm 缓存数据库不可写而失败，提权重跑成功。
- `./node_modules/.bin/jest --runInBand`：8 个测试套件、26 项测试全部通过，其中 11 项为训练路由测试。
- `./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-training-routes-web`：通过。
- `./node_modules/.bin/expo export --platform android --output-dir /tmp/ridepilot-training-routes-android`：通过，生成 Hermes bundle。
- 修改文件的 Prettier 检查和 `git diff --check`：通过。

额外执行 `eslint .` 会扫描仓库原有 `apps/mobile/dist` 生成产物并报生成代码错误；项目标准 `expo lint` 的源码检查通过。本次没有修改生成产物或关闭 lint 规则。

本次未改数据库或 API 契约，未新增依赖。未进行 Android/iOS 真机手势验收；测试中的导航返回与 Web/Android 打包不等同于真机联调。

### 2026-10-22 人工课程一键保存验证

- `apps/mobile`：`./node_modules/.bin/jest --runInBand` 通过，8 个套件、31 项测试（训练路由 16 项）。覆盖新建直接发布、编辑保存、校验阻断和修正、应用超时重试复用同一幂等键、版本冲突保留内容、保存中禁用编辑和重复提交、保存中阻止导航离开、已应用后的新编辑保护。
- `apps/mobile`：`./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint src app` 均通过。
- `apps/api`：`./node_modules/.bin/tsc -p tsconfig.json --noEmit` 通过；`./node_modules/.bin/jest --runInBand test/cors.e2e-spec.ts` 通过，2 项测试。CORS 测试首次因沙箱禁止监听本地端口失败，提权重跑通过。
- 根目录：`./node_modules/.bin/oxlint apps/api/src/configure-app.ts apps/api/test/cors.e2e-spec.ts`、本次文件的 Prettier 检查、`git diff --check` 均通过。
- `apps/mobile`：`./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-manual-save-web`、`./node_modules/.bin/expo export --platform android --output-dir /tmp/ridepilot-manual-save-android` 均通过。

本次无数据库迁移或新增依赖。未进行真机操作验收；移动端导航测试 mock API，后端原子发布实现沿用已有接口。

## 首页入口与反馈刷新（2026-10-30）

首页通过 `action=adjust|feedback` 复用课程详情已有表单。反馈失败保留状态、数字和备注，成功重新读取详情展示服务端记录；已有记录的课程禁止重复反馈、编辑和 AI 调整。单节调整预览展示原日期与候选日期，明确仅替换一节；失败保留草稿，应用响应超时重试原提案与幂等键，成功返回训练日历读取新版本，不再读取失效的旧课程 ID。无训练日支持从首页手动创建当天课程。
