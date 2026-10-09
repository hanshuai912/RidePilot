# 后端基础设施

## 目的与范围

为 RidePilot 的后续业务功能建立 NestJS API、共享契约、PostgreSQL 与 Redis 的可运行基线。本次仅提供公开健康检查，不实现账户、训练或 AI 业务接口。

## 运行流程

Compose 启动 PostgreSQL、Redis 和可选的 API 容器；也可只启动两个依赖容器，在宿主机运行 API。API 启动时校验环境变量并连接两项依赖，失败时启动失败。`GET /api/v1/health` 检查 PostgreSQL 查询和 Redis PING，任一失败返回 503。

## 技术实现

- `apps/api/src/config/env.ts`：Zod 校验环境变量，只在错误中列出字段名。
- `apps/api/src/infra/infra.module.ts`：向领域模块显式导出数据库与 Redis 服务，避免重复建立连接。
- `apps/api/src/infra/prisma/`：Prisma 7 与 PostgreSQL 驱动适配器，负责数据库连接生命周期。
- `apps/api/src/infra/redis/`：Redis 连接生命周期；业务缓存策略尚未定义。
- `packages/contracts/src/health.ts`：健康检查响应契约。
- `apps/api/Dockerfile` 与 `compose.yaml`：容器构建、依赖顺序、数据卷与健康检查。
- 本地 `pnpm dev:api` 通过 Nest CLI 监视编译，保留依赖注入所需的 TypeScript 装饰器元数据。
- `apps/api/src/docs/swagger.ts` 与 `apps/api/src/configure-app.ts`：注册 Swagger UI 和 OpenAPI JSON；健康响应从共享 Zod schema 生成文档。

## API 契约

| Method | Path             | 成功                              | 失败                          | 权限 |
| ------ | ---------------- | --------------------------------- | ----------------------------- | ---- |
| GET    | `/api/v1/health` | 200，数据库与 Redis 状态均为 `ok` | 503，`DEPENDENCY_UNAVAILABLE` | 公开 |

具体响应见 [健康检查 API](../api/health.md)。公开接口不读取或修改用户数据；后续业务接口必须增加鉴权及归属校验。

Swagger 页面和 JSON 地址及启用规则见 [OpenAPI 文档](../api/openapi.md)。

## 数据与迁移

Prisma schema 目前只定义 PostgreSQL 数据源与 Client 生成器，未建立业务表或迁移。Redis 使用持久化卷，但尚无业务缓存键。数据约束在对应功能设计时落实，参见 [数据基线](../data/foundation.md)。

## 错误与安全

缺少或错误的连接配置会阻止 API 启动。健康检查失败只返回通用错误码和提示，不返回连接串。开发容器端口仅绑定本机回环地址。生产部署必须替换示例凭据并配置网络访问控制。

## 测试与验证

`apps/api/test/health.e2e-spec.ts` 使用模拟依赖验证 200、数据库故障 503、Redis 故障 503，以及连接错误不外泄。

已执行并通过：

- `pnpm install --frozen-lockfile`
- `pnpm db:validate`（使用示例 PostgreSQL URL）
- `pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm format:check`
- `pnpm test`：4 个集成用例通过，包含 Swagger 页面与 OpenAPI 契约
- `docker compose config --quiet`
- `docker compose up --build -d api`：API、PostgreSQL、Redis 均达到 healthy
- `curl http://127.0.0.1:3000/api/v1/health`：返回数据库与 Redis 状态均为 `ok`
- 容器内 `pnpm db:validate`：Prisma schema 有效
- `PORT=3001 pnpm dev:api` 后请求 `http://127.0.0.1:3001/api/v1/health`：返回 HTTP 200，数据库与 Redis 均为 `ok`
- `PORT=3001 pnpm dev:api` 后请求 `/api/docs` 与 `/api/docs-json`：页面返回 200，JSON 为 OpenAPI 3.0，包含健康接口的 200/503 响应
- `NODE_ENV=production SWAGGER_ENABLED=false PORT=3001 pnpm --filter @ridepilot/api start`：`/api/docs` 返回 404，健康接口仍返回 200

## 变更记录与未决问题

- 2026-10-08：创建后端与容器化基础设施。
- 2026-10-09：将本地监视模式改为 Nest CLI 编译，修复依赖注入元数据缺失导致的健康检查 500 错误。
- 2026-10-09：接入 Swagger，公开健康检查的 OpenAPI 定义。
- 移动端、账户模型、认证、业务缓存策略和迁移随对应功能实现。
