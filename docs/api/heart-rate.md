# 心率区间设置 API

前缀 `/api/v1`；均要求 Access Token。当前用户从认证上下文取得，请求不接受 `userId` 等额外字段。

## GET `/me/heart-rate-settings`

返回 `{ "settings": null }` 表示从未配置。已配置时 `settings` 包含 `method`（`MAX` / `RESERVE` / `LTHR`）、`maxHeartRate`、`restingHeartRate`、`lactateThresholdHeartRate`、`ruleVersion: 1`、正整数 `version` 及 UTC ISO `updatedAt`。三个心率字段为整数 bpm 或 null。

## PUT `/me/heart-rate-settings`

提交完整设置（当前类型及三个心率字段）和必填的 `expectedVersion`；首次保存使用 0，其后使用 GET 返回版本。响应为已保存的设置对象（不包 `settings`）。

```json
{
  "method": "RESERVE",
  "maxHeartRate": 200,
  "restingHeartRate": 60,
  "lactateThresholdHeartRate": null,
  "expectedVersion": 0
}
```

最大/阈值心率范围 80–250，静息心率 20–120。MAX 必填最大心率；RESERVE 必填最大和静息，差值至少 10；LTHR 必填乳酸阈心率。任意已填写的静息心率必须小于已填写的最大心率。非当前类型的合法数值一并保留；不接受未知字段或小数。

- 400：输入非法、缺少当前类型字段或传入用户归属字段。
- 401：无效/缺少认证。
- 409 `HEART_RATE_VERSION_CONFLICT`：读取版本已过期且不属于相同内容的最近重试；重新读取后编辑，不自动覆盖。
- 相同内容提交当前版本或紧邻前一版本返回同一记录，不重复递增版本。首次并发保存同一内容只有一行、一个版本。

共享 schema 同时驱动移动端校验、服务端 ZodBodyPipe 与 OpenAPI。区间由共享纯函数计算，不将派生区间存入数据库。完整规则见 [功能文档](../features/heart-rate-zones.md)。
