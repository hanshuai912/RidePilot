# 后端架构基线

`apps/api` 是 NestJS 模块化单体，入口统一使用 `/api/v1`。当前只有 health 模块；业务功能按领域新增 controller、service、repository。`packages/contracts` 存放可供未来移动端与 API 共用的 Zod 请求/响应 schema，不共享 Prisma 类型。

`InfraModule` 显式导出 Prisma 与 Redis 服务，后续业务模块按需导入，避免为每个模块重复建立连接。PostgreSQL 是持久化数据源，由 Prisma 访问。Redis 作为后续缓存或可靠异步任务的基础设施，现阶段只建立连接并参与健康检查，不预设缓存键或队列。容器由 `compose.yaml` 管理；API 可在宿主机或 Docker 中运行。

设计取舍见 [ADR 0001](../adr/0001-backend-foundation.md)，运行命令见 [README](../../README.md)。
