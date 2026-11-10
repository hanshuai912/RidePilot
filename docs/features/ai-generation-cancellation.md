# AI 生成取消

## 目的与范围

为训练、阶段安排、课程调整、资料变更重排、周期复盘、赛事训练及营养生成提供取消能力。AI 教练的待处理建议列表也可取消本人后台任务。生成结果仍须经过校验、预览和用户确认才可应用。

## 用户流程与页面状态

- 提交任务并取得任务 ID 后启用“取消生成”。提交尚未返回时按钮禁用。
- 取消请求期间按钮显示加载状态并阻止重复点击；请求失败显示错误，可再次取消，原轮询继续。
- 取消成功显示“已取消生成”，轮询读到终态后结束等待，用户可重新生成；新请求使用新的幂等键。
- 任务已完成或失败时取消返回 409，提示查看生成结果；不会删除已有草稿。
- 普通返回或离开页面仍沿用原有恢复语义，不自动取消任务。用户可在待处理建议中显式取消。

## 技术实现

- 共享契约：`packages/contracts/src/coach.ts` 的生成响应增加 `CANCELLED`；阶段复评与资料变更记录同步兼容。
- 接口：训练入口位于 `apps/api/src/modules/coach/ai-generation.controller.ts`；营养入口位于 `apps/api/src/modules/nutrition/nutrition-generation.controller.ts`。
- 取消业务：`apps/api/src/infra/prisma/generation-cancellation.service.ts`，只处理本人任务。
- 后台：训练和营养 Worker 使用 `watch-generation.ts` 每秒读取任务状态；取消或 Worker 已失去当前尝试所有权时中断请求。阶段生成复用训练 Worker 的信号。
- Provider：`AiRequest.signal` 在服务端传至模型 HTTP 请求，与原超时信号合并；主动取消归类为不可重试的 `AI_GENERATION_CANCELLED`。
- 移动端：`useGenerationCancellation` 负责请求与错误状态，`GenerationCancelButton` 复用现有黑金暗色 Button；训练、目标、营养、赛事等页面接入。
- 三种轮询服务均将 `CANCELLED` 作为终态，停止获取草稿；不会继续导航或应用。

## API 契约

完整前缀为 `/api/v1`，均要求 Bearer 登录态。

| Method | Path                                | 请求           | 响应与权限                           |
| ------ | ----------------------------------- | -------------- | ------------------------------------ |
| POST   | `/ai-coach/generations/:id/cancel`  | UUID，无请求体 | 200 生成响应；可取消本人任意生成场景 |
| POST   | `/nutrition/generations/:id/cancel` | UUID，无请求体 | 200 生成响应；仅本人营养任务         |

允许 `QUEUED / RUNNING → CANCELLED`；重复取消返回同一终态，无须额外幂等键。响应包括 `generationId`、`status`、`proposalId`、`errorCode`、`requestId`，取消任务的草稿 ID 及错误码均为空。

未登录返回 401，非法 UUID 返回 400，不存在、非本人或营养接口访问其他场景返回 404，READY/FAILED 返回 409 `GENERATION_NOT_CANCELLABLE`。

## 数据、并发与兼容性

复用 `ai_generations.status` 的 varchar 字段，无数据库迁移。取消在事务内锁定用户行，并按本人、场景、活动状态执行条件更新，清空租约与错误码。草稿最终落库使用相同用户锁和 RUNNING/attempts 条件：取消先成功时迟到结果不创建草稿；完成先成功时取消返回 409。异常重试和任务领取也受状态条件保护，不能复活取消任务。

已取消任务进入最近记录，不再属于待处理任务，也不会被输入去重机制复用。原提交幂等键仍返回原取消结果；重新生成需新键。客户端与 API 应一起更新，旧客户端未识别该终态。

模型 HTTP 中断是尽力而为，不能保证供应商立即停止计算或不计费。即使供应商返回迟到结果，数据库状态检查仍保证取消后不创建候选、不改正式计划。

## 测试与验收

- `apps/api/test/generation-lifecycle.e2e-spec.ts`：排队取消、重复取消、401/400/404/409、归属隔离、重新生成、训练/阶段/营养迟到结果及取消后不重试。
- `apps/api/test/watch-generation.spec.ts`：跨进程状态观察、中断、尝试过期、瞬时数据库读取失败恢复及定时器释放。
- `apps/api/test/ai-provider.spec.ts`：取消正在请求的模型、已取消请求不发送以及原超时行为。
- `apps/mobile/src/features/coach/__tests__/generation-cancellation.test.tsx`：API 分流、重复点击、失败重试及三种轮询终止。
- 手工验收：任一生成页面点击生成 → 取得任务 ID 后取消 → 显示取消状态 → 再次生成 → 预览草稿；检查原正式计划保持原版本。

2026-11-10 实际验证：

| 命令                                                                         | 结果                                                                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm --filter @ridepilot/contracts build`                                   | 通过，共享契约声明已同步                                                                        |
| `pnpm typecheck`                                                             | 通过，contracts / api / mobile                                                                  |
| `pnpm lint`                                                                  | 通过，API / contracts oxlint 与 Expo lint                                                       |
| `pnpm build`                                                                 | 通过，contracts 与 API 构建                                                                     |
| `pnpm --filter @ridepilot/api test:integration`                              | 44 个套件通过，299 项测试通过，既有 1 套件 / 1 项测试跳过；本地隔离测试库 17 个迁移，无待迁移项 |
| `pnpm --filter @ridepilot/mobile test`                                       | 38 个套件、335 项测试全部通过                                                                   |
| 对本次修改的 TS / TSX / Markdown 执行 `prettier --check`；`git diff --check` | 通过                                                                                            |

首次全量回归暴露新增 Controller 依赖未加入独立测试模块和赛事加载展示断言需要更新，已修正后重跑通过。未运行真机或真实模型验收。

## 变更记录

2026-11-10：增加显式取消接口、页面按钮和 CANCELLED 终态，复用现有任务表与事务协议。
