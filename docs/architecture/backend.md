# 后端架构基线

AI 教练持续协作中心在 `CoachModule` 内新增 `CoachOverviewService`、独立状态规则、`CoachSuggestionsRepository/Service` 和薄控制器。概览使用一致读取事务，建议查询与生命周期写入分离；问答复用概览和已有 AI 编排器，无新增模型客户端或数据表，见 [持续协作中心](../features/ai-coach-center.md)。

`apps/api` 是 NestJS 模块化单体，入口统一使用 `/api/v1`。当前包含 health、auth、profile、training、coach 和 AI 基础设施模块；业务功能按领域新增 controller、service、repository。`packages/contracts` 存放移动端与 API 共用的 Zod 请求/响应 schema，不共享 Prisma 类型。

`TrainingModule` 将草稿/查询、正式应用事务、数据查询和响应映射分别放入 service、application service、repository 和 mapper。人工课程无需先有正式计划；首次确认应用在事务内创建正式计划和第 1 版，沿用草稿校验、用户确认、版本和幂等约束，详见 [手动训练课程](../features/manual-training-workout.md)。

`CoachModule` 按资料、训练事件、AI 生成任务、提案应用、恢复与只读聊天拆分。AI 生成任务持久化在 PostgreSQL，由带租约的 worker 执行，状态可轮询；模型只产出待校验草稿，正式计划写入仍走用户锁和版本事务。业务 Skill 从固定版本的 MIT 开源骑行资料适配，原文与许可保存在服务端 Skill 目录；运行加载器只读取经审查的骑行规则、一个场景引用和来源清单哈希。详见 [AI 教练功能](../features/ai-coach.md)。

`InfraModule` 显式导出 Prisma 与 Redis 服务，后续业务模块按需导入，避免为每个模块重复建立连接。PostgreSQL 是持久化数据源，由 Prisma 访问。Redis 目前用于健康检查和鉴权频率限制；AI 任务首版使用 PostgreSQL 持久化与租约，不依赖 Redis 队列。容器由 `compose.yaml` 管理；API 可在宿主机或 Docker 中运行。

`AuthModule` 注册全局认证守卫。所有 Nest Controller 路由默认要求 Access Token；只有显式标记 `@Public()` 的健康检查、注册、登录和刷新接口公开。守卫校验 JWT 类型、签名和数据库会话状态，退出后访问立即失效。后续涉及用户数据的服务还需按当前 `userId` 检查资源归属，不能把登录态验证当作归属校验。

设计取舍见 [ADR 0001](../adr/0001-backend-foundation.md)和[ADR 0002](../adr/0002-authentication.md)，运行命令见 [README](../../README.md)。

阶段测试服务位于 CoachModule，按日程冲突、状态与幂等写入、复评证据拆分，原 CoachEvents 仅保留活动和赛事。范围 AI 上下文读取服务端复评证据，正式课程应用复用原版本事务。见 [阶段测试](../features/stage-assessments.md)。

## 2026-11-05：生成候选生命周期

`infra/prisma/generation-candidates.ts` 封装跨训练/阶段/营养的输入指纹、任务身份、复用与成功替代的持久化规则，各领域服务提供候选有效性判断。提交和 worker 保存均锁用户行；模型调用在事务外，返回后重读上下文。CoachSuggestionsRepository 提供一致快照，Service 只读投影失效历史；NutritionGenerationStaleReason 在营养应用和联动状态恢复时重查新生成快照。没有新增服务依赖、数据库迁移或主动触发生成。详情见 [生命周期](../features/coach-suggestion-lifecycle.md)。
