# 训练资料驱动的课程调整

2026-11-11：训练页将原独立“资料变更与未来训练”卡片收进日历底部，入口名为“训练安排核对”；保留真实待核对课程数、错误提示与原详情流程，日历刷新同步刷新核对状态。详见 [训练页布局](training-home-layout.md)。

## 目的与范围

本次调整将产品定位收敛为“根据当前训练资料生成训练计划”。用户可以自行安排并完成测试，但测试结果不再是课程生成或复评的前置条件。训练完成记录和训练目标管理保持原有流程。

## 用户流程

1. 用户在 App 外自行安排和完成测试；App 不再提供测试安排、测试建议入口或测试结果录入。
2. 用户直接在个人资料中更新 FTP、体重、身高、训练经验等身体条件。
3. App 根据正式课程保存时的资料快照检查未来课程；发现 FTP、身体资料、可训练时间或目标依据变化时，进入“资料变更与未来训练”。
4. 用户选择保留原课程、只重算 FTP 或生成新的课程草稿。草稿仍需预览、校验和确认后才能应用，历史课程和训练记录不被覆盖。

## 实现边界

- 历史测试数据和旧接口暂时保留，新的主要页面不展示测试建议，也不提供安排测试的路由；测试结果不会参与新的日期范围课程生成。
- 阶段复评和结果录入接口及历史数据暂时保留，旧链接可以读取历史内容，但新的主要入口不再引导用户完成这些操作。
- 课程生成不再从目标详情读取测试 ID/版本，也不要求测试状态为已完成、跳过或无效。
- `TrainingInputSnapshot` 新增个人资料和心率设置快照。新生成课程可以检测身高、体重、训练经验或心率设置变化；缺少旧资料快照的历史课程保持兼容，不自动猜测旧条件。
- 资料影响提示使用现有 `PlanInputDecision` 流程。用户确认前不修改正式版本，生成和应用仍使用幂等键、用户归属校验、版本及指纹冲突检查。

## 主要代码

- 移动端：`features/goals`、`features/assessments`、`features/profile`、`features/plan-impact`。
- 后端：`training-input-snapshot.ts`、`plan-impact`、`training-range.service.ts`、`coach-generation-context.service.ts`、周期复盘策略。
- 契约：`packages/contracts/src/plan-impact.ts` 的影响类型增加 `PROFILE`。

## 验收点

- 阶段页面显示测试建议，但不出现新的“录入结果 / 复评并选择下一步”主操作。
- 课程范围生成请求不携带测试 ID/版本；后端可以在没有测试结果的情况下生成草稿。
- 更新个人资料后，未来训练影响页可显示个人资料变化，并提供重新生成入口。
- 重新生成前后历史训练记录保持不变；正式计划只有在确认应用后更新。

## 验证记录

本次实现后执行：

- `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json --noEmit`：通过。
- `./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`：通过。
- `./node_modules/.bin/tsc -p apps/mobile/tsconfig.json --noEmit`：通过。
- `apps/api/test/plan-impact-policy.spec.ts`、`cycle-review-policy.spec.ts`、`coach-status.spec.ts`：12 项通过。
- 移动端受影响 Jest：4 组、38 项通过，已移除测试安排入口的 10 项旧流程断言标记为跳过。
- API 受影响单元测试：3 组、12 项通过。API 全量 Jest 的 HTTP 套件在当前沙箱因 `listen EPERM` 无法绑定 `127.0.0.1`，未将环境失败计入功能通过。
- API 集成测试未执行：仓库当前没有 `apps/api/.env.test`，因此无法启动隔离 PostgreSQL / Redis 测试环境。

## 未决事项

- 是否在后续版本完全删除测试结果和阶段复评的数据模型与接口，需要单独的数据迁移评估；当前只移除新的主流程依赖。
