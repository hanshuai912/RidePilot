# 用户档案数据

迁移：`apps/api/prisma/migrations/20261009063809_user_profile/migration.sql`。

- `users.display_name`、`users.timezone`、`users.locale` 保存账户展示与地区偏好。
- `users.profile_version` 用于局部更新的乐观版本检查；带 `expectedVersion` 的更新必须匹配当前值，成功后原子递增。
- `athlete_profiles` 与 `users` 一对一，通过 `user_id` 唯一约束关联；保存性别、年龄段、身高、体重、训练经验、建档训练意向、设备标记和视图偏好。
- 身高和体重使用显式单位字段名对应的 Decimal 数值；接口转换为 JSON number。FTP 等能力测量不放在此表，后续使用带来源、时间和可信度的历史表。

POST 通过单一事务更新账户和档案，档案首次更新使用 upsert。手机号、验证状态和凭据不在档案写路径中。当前用户归属来自全局认证守卫，不接受客户端提供用户 ID。
