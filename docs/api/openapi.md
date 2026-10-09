# OpenAPI 与 Swagger

本地开发访问 `/api/docs` 查看 Swagger UI，访问 `/api/docs-json` 获取 OpenAPI JSON。API 路由仍以 `/api/v1` 为前缀。

`apps/api/src/docs/swagger.ts` 负责文档注册，`apps/api/src/configure-app.ts` 将文档与 API 路由配置应用到 Nest 实例。健康、认证和用户档案接口的主要请求/成功响应 schema 由 `packages/contracts` 的 Zod schema 转换为 OpenAPI 3.0，错误响应由控制器说明。受保护接口在 Swagger UI 使用 `access-token` Bearer 认证方案。后续新增接口时应同步维护运行时 Zod 校验、Swagger 注解、共享契约和本目录文档。

`SWAGGER_ENABLED` 控制文档页面和 JSON 的注册。开发环境默认开启，生产环境默认关闭；本地 Compose 显式设为 `true`。生产部署如需开放文档，应结合网络访问控制评估。
