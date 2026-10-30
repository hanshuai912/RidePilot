# 统一心率设置持久化

迁移：`apps/api/prisma/migrations/20261030110000_heart_rate_settings/migration.sql`。

`heart_rate_settings.user_id` 同时为主键与 users 外键，删除用户时级联删除；每用户一套通用心率设置，不含运动类型字段。所有查询与更新按认证 userId 过滤。

| 列                           | 含义                       |
| ---------------------------- | -------------------------- |
| method                       | MAX / RESERVE / LTHR       |
| max_heart_rate               | 最大心率，整数 bpm，可空   |
| resting_heart_rate           | 静息心率，整数 bpm，可空   |
| lactate_threshold_heart_rate | 乳酸阈心率，整数 bpm，可空 |
| rule_version                 | 计算规则版本，当前为 1     |
| version                      | 更新版本，首次为 1         |
| created_at / updated_at      | UTC 时间                   |

CHECK 约束覆盖方法、数值范围、所选类型必填、静息低于最大、储备法差值至少 10 及正版本。Prisma schema 与手写 SQL migration 一同维护；CHECK 是 SQL 管理的约束，不要使用 db push 替代 migration。

事务锁定 users 当前用户行后读取设置，先判定相同内容重试，再校验 expectedVersion，最后创建或递增更新。锁覆盖首次创建，避免两个版本 0 请求同时创建。只锁当前用户，不阻塞其他用户的心率保存。

本表是当前配置，不冒充带测量协议/来源的能力测量记录，也不更改 FTP 历史。规则版本持久化，后续规则变更应新增版本并同步契约与计算。区间是派生数据，不重复存储。

兼容性：新增表无现有数据改写。应用回退可停止使用此接口并保留表；不建议直接 DROP TABLE，若必须删除先导出配置并确认影响。生产迁移应使用正常发布流程。

本地执行：在 `apps/api` 使用 `./node_modules/.bin/prisma migrate deploy`，随后 `./node_modules/.bin/prisma migrate status`。测试只能使用 `.env.test` 中本机 `*_test` 数据库和 Redis DB 1。

本任务已对本地 `ridepilot` 和隔离测试库 `ridepilot_test` 完成迁移；开发库 status 确认最新，真实心率 API 的持久化、并发、隔离和数据库约束测试通过。
