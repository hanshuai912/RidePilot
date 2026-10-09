# 数据基线

当前只配置 PostgreSQL 数据源和 Prisma Client 生成器，尚无用户或训练表，也无迁移。创建首个业务表时须同时提交 Prisma migration、索引及约束说明，并更新对应功能文档。用户相关表需明确归属字段，关键写操作需设计事务、幂等键与版本冲突校验。

Compose 的 `postgres_data` 卷保存开发数据库；`redis_data` 卷保存 Redis 开发数据。`docker compose down` 保留卷，只有显式删除卷才会清除数据。
