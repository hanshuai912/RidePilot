# API 依赖启动与 Redis 故障处理

## 启动与诊断

API 使用 Redis 执行认证频率限制及就绪检查，启动前必须提供可用连接。在仓库根目录执行：

```bash
docker compose up -d --wait postgres redis
docker compose exec -T redis redis-cli ping
pnpm dev:api
```

第二条应返回 `PONG`。PostgreSQL 与 Redis 应保持运行，直到本地开发结束；启动 API 不会自动启动 Docker 服务。

`ECONNREFUSED 127.0.0.1:6379` 表示 Redis 目标地址没有接受连接。检查 `docker compose ps`、Redis 容器状态及 `apps/api/.env` 的 `REDIS_URL`。宿主机默认 `redis://127.0.0.1:6379`，API 容器使用 `redis://redis:6379`；如修改根目录 `.env` 的 `REDIS_PORT`，需同步宿主机 `REDIS_URL`。不要在故障排查日志中输出完整含凭据的 URL。

## 3000 端口冲突

`EADDRINUSE 0.0.0.0:3000` 表示已有服务占用 API 默认端口。使用 `docker ps --filter publish=3000` 及 `ss -ltnp 'sport = :3000'` 定位占用者。若为本仓库 `ridepilot-api-1` 容器，开发时执行 `docker compose stop api`，然后重新运行宿主机 `pnpm dev:api`；数据库和 Redis 继续运行。API 不会自动杀掉占用端口的服务。

## 实现与边界

- `RedisService` 注册 `error` 监听，记录经校验的错误码，不记录原始连接异常或凭据；连接超时为 5 秒。
- 启动连接失败时停止该客户端的重连并抛出明确的依赖启动命令。`main.ts` 捕获启动异常、关闭已创建的应用，以状态码 1 退出，避免未处理的 Promise 拒绝。
- 已启动服务仍沿用 ioredis 的运行期重连机制；Redis 故障时健康检查返回 503，认证限流保持原有故障处理策略。
- 无 API 契约、环境变量名称、依赖包或数据库迁移变化。

## 验证

`apps/api/test/redis.service.spec.ts` 覆盖启动失败的错误处理、敏感信息隐藏、停止重连及运行期错误监听/关闭；`health.e2e-spec.ts` 覆盖依赖成功和故障响应。实际验证结果见[本次记录](../testing/api-startup-professional-editor-2026-11-09.md)。
