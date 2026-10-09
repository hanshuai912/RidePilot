# 健康检查 API

`GET /api/v1/health` 为公开的基础设施就绪检查，不包含用户数据。

成功时返回 HTTP 200：

```json
{ "status": "ok", "services": { "database": "ok", "redis": "ok" } }
```

PostgreSQL 或 Redis 不可用时返回 HTTP 503，响应含 `code: "DEPENDENCY_UNAVAILABLE"` 和通用中文提示。该接口不暴露连接配置或原始错误。响应结构由 `packages/contracts/src/health.ts` 定义。
