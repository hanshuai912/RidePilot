# 认证 API

API 前缀为 `/api/v1`。注册、登录、刷新令牌公开；退出需要 `Authorization: Bearer <accessToken>`。请求和成功响应以 `packages/contracts/src/auth.ts` 为契约来源，Swagger 位于 `/api/docs`。

| 方法 | 路径             | 请求                                                       | 成功                | 主要错误                                                                          |
| ---- | ---------------- | ---------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| POST | `/auth/register` | `phone`, `verificationCode`, `password`, `confirmPassword` | 201，用户与令牌对   | 400 格式/密码不合规、409 手机号已注册、429 限流、503 测试注册关闭或限流设施不可用 |
| POST | `/auth/login`    | `phone`, `password`                                        | 200，用户与令牌对   | 400 格式错误、401 凭据错误、429 限流                                              |
| POST | `/auth/refresh`  | `refreshToken`                                             | 200，轮换后的令牌对 | 400 请求错误、401 令牌无效/已用/已撤销、429 限流                                  |
| POST | `/auth/logout`   | Bearer Access Token                                        | 204，无响应体       | 401 未登录或会话已失效                                                            |

当前测试阶段 `phone` 按 PRD 建议校验为 11 位数字；`verificationCode` 可为任意 6 位数字，不触发短信发送，也不证明手机号归属。密码至少 6 个字符，并包含大写字母、小写字母、可见 ASCII 标点符号中的至少两类；数字不计入类别。该手机号格式及特殊符号范围是**当前建议口径**，不是 PRD 已确认的最终范围。`confirmPassword` 仅用于当次一致性校验，不存储。

成功响应示意：

```json
{
  "user": { "id": "<uuid>", "phone": "13812345678", "phoneVerified": false },
  "tokens": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresInSeconds": 900
  }
}
```

Access Token 有效期 15 分钟，Refresh Token 有效期 30 天且每次刷新后轮换。旧 Refresh Token 立即失效；退出撤销当前数据库会话，关联的 Access Token 也立即失效。登录失败对不存在的手机号和错误密码统一返回 `INVALID_CREDENTIALS`，不暴露账号是否存在。测试验证码注册只在 `AUTH_TEST_CODE_ENABLED=true` 时开放，生产默认关闭。

Redis 限流不可用时认证请求返回 503 `AUTH_RATE_LIMIT_UNAVAILABLE`，不会绕过防滥用检查。注册/登录/刷新均可能返回 429 `AUTH_RATE_LIMITED`。

此后新增业务路由默认经过全局认证守卫。读取或修改带 `userId` 的资源时，业务服务仍须核对资源归属。
