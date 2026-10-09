# ADR 0001：后端与本地基础设施基线

状态：已采用（2026-10-08）

## 背景

开发规范要求 pnpm Monorepo、NestJS、PostgreSQL、Prisma 和共享 Zod 契约。用户要求数据库、缓存等服务端基础设施通过 Docker 启动，并提供 Dockerfile。

## 决策

- 使用 NestJS 11 模块化单体，与规范指定的 Jest 测试栈保持简单兼容，避免在初始阶段拆分微服务。
- 使用 Prisma 7 的 PostgreSQL 驱动适配器；首期不预设业务表。
- Compose 管理 PostgreSQL、Redis 和可选的 API 容器；API Dockerfile 位于 `apps/api`。
- API 镜像基于 Node.js 24 Debian slim，并安装 OpenSSL，供 Prisma CLI 使用。
- Redis 目前只用于连接及就绪检查。缓存键、过期策略和队列在业务需求明确后设计。
- 不在容器启动时自动运行数据库迁移，避免多实例并发迁移和隐式结构变更。

## 后果

后续新增业务模型时需要提交 migration，并在部署流程中显式执行迁移。开发环境需要 Node.js 24、pnpm 11 和 Docker Compose。React Native 移动端本次未初始化，后续仍在同一 pnpm workspace 中添加。
