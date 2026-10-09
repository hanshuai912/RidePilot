# 数据基线

当前已创建账户、手机号凭据和认证会话表，详见 [认证数据模型](./authentication.md)。训练等业务表尚未建立。新增业务表时须同时提交 Prisma migration、索引及约束说明，并更新对应功能文档。用户相关表需明确归属字段，关键写操作需设计事务、幂等键与版本冲突校验。

Compose 的 `postgres_data` 卷保存开发数据库；`redis_data` 卷保存 Redis 开发数据。`docker compose down` 保留卷，只有显式删除卷才会清除数据。
