# 阶段测试数据与迁移

2026-11-10：测试在综合训练日程中统一展示，`goal_id` 继续保留来源，`stage_id` 可关联共享综合阶段；不新增重复测试或迁移历史记录。同类测量的可比条件不再要求来源目标相同，但仍要求方法、来源、实际日期和相关测试参数等满足原规则。安排预览指纹纳入全部活跃目标，目标变更后需重新预览。详见 [综合规划](../features/unified-goal-planning.md)。

`20261030200000_stage_assessments` 追加 TrainingAssessment 字段：stage_id（TrainingStage 外键，删除置空）、kind、actual_date、source、rpe、duration_seconds、route_name、distance_km、notes、reason、comparable_conditions、baseline_ftp_watts、ftp_measurement_id（唯一）。原 local_date 始终表示当前计划日期；实际执行日期独立保存。版本每次实际状态写入或确认 FTP 递增。

result_watts 的含义由 kind 决定：FTP 是协议最终结果，POWER_DURATION 是实际时长内的平均功率，FIXED_ROUTE 不使用该列；旧行默认 LEGACY，不推断协议或回填新的实际日期/来源/RPE。功率 W，时长秒，距离 km；数据库 DATE 不随服务器时区偏移。createdAt/updatedAt 与能力 measuredAt 为时间戳。

baseline_ftp_watts 是安排时快照；确认 FTP 另写 AbilityMeasurement（metricType FTP、unit W、source TEST、confidence USER_CONFIRMED），测试的 ftp_measurement_id 关联该测量。原实际日期、方法与设备来源仍保留在测试上。输入只有日期时，measuredAt 使用该用户时区当天起点；同日已有测量时采用后续毫秒顺序，不超过当前时间或越过实际日期。确认时检查当前 FTP ID 与测试版本，较旧测试日期不覆盖较新能力值。

AssessmentMutation 保存 user_id、key、SHA256 请求签名及 JSON 原响应，唯一 `(user_id,key)`，用户删除级联清理。与实际写操作在同一个事务中提交；重试相同键/请求返回原响应，不同请求使用同键拒绝。日志当前随账号保留，尚未添加定时清理策略。

状态：SCHEDULED / POSTPONED / INCOMPLETE → 完成、未完成、改期、跳过、无效；COMPLETED → INVALID（保留结果及已写能力历史）；SKIPPED / INVALID 终结。POSTPONED 在课程生成和应用的避让查询内。用户锁串行化安排/改期、FTP、课程发布与赛事修改，预览指纹包含目标/阶段/FTP 与同日安排快照。

部署前先部署兼容契约与 API，执行 `pnpm --filter @ridepilot/api db:deploy` 并同步客户端。开发阶段升级后旧版创建请求会被拒绝，需要一起升级。迁移无删除、无覆盖回填；回滚应用时保留新增列和历史记录，优先向前修复，不执行 drop 或数据库重置。

既有测试在阶段归档或目标暂停后仍可改期，保留原关联，不据此创建新阶段；新测试需选择活跃目标和阶段。计划版本恢复也检查改期后的测试日期，不能借恢复覆盖测试日。
