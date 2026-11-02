# 阶段测试 API

前缀 `/api/v1`，全部 Bearer 鉴权，资源按当前用户隔离；UUID 与日期由共享 Zod 契约校验。Swagger `/api/docs` 同步展示请求和响应 schema。

| Method | Path                                | 请求 / 响应                                                                                    |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/assessments?goalId=&from=&to=`    | 测试数组；目标/历史最多 100 条，双日期日历窗口不截断且最多一年                                 |
| POST   | `/assessments/schedule-preview`     | `AssessmentPreviewInput` → token + conflicts，不写正式日程                                     |
| POST   | `/assessments`                      | `AssessmentInput` + `Idempotency-Key` → 已安排测试                                             |
| GET    | `/assessments/:id`                  | `Assessment`                                                                                   |
| PATCH  | `/assessments/:id`                  | `AssessmentPatch` + `Idempotency-Key` → 测试，需 expectedVersion                               |
| GET    | `/assessments/:id/review`           | `AssessmentReview`：测试、当前 FTP、上次可比结果、差值、阶段记录、解释、canUpdateFtp           |
| POST   | `/assessments/:id/ftp-confirmation` | `{ expectedVersion, expectedFtpId }` + `Idempotency-Key` → 更新后的测试，单独用户确认后调用    |
| POST   | `/plans/generate-range-proposal`    | 既有 STAGE / DATES 请求可附 assessmentId + assessmentVersion，必须同时传；只产生待预览课程草稿 |

安排需 goalId、可选 stageId、localDate、kind（FTP / POWER_DURATION / FIXED_ROUTE）、protocol。创建附预览 token 与 acknowledgeConflicts；不接受未预览/过期预览。改期预览使用原测试上下文和 excludeId 排除自身，PATCH 必须带新日期、原因、token 与冲突确认。

完成需 actualDate、protocol、source、rpe 及类型对应结果；未完成需 actualDate + reason；跳过/无效需 reason；改期需新日期 + reason。完成状态只允许进一步标记无效，终结状态不能重新填结果。旧版 LEGACY 仅允许跳过/作废。

结果保存不创建 AbilityMeasurement，不改变课程或阶段。FTP 确认只接受完成且类型 FTP、字段齐全、未确认的测试；校验当前能力 ID，不能覆盖日期更新的能力值。确认后测试版本递增并返回 ftpMeasurementId，历史课程不重新计算。

400 为字段/日期/FTP 缺失，401 未认证，404 不存在/非本人资源，409 为预览、版本、状态、FTP 或幂等键冲突。主要代码：`FTP_REQUIRED`、`ASSESSMENT_PREVIEW_STALE`、`ASSESSMENT_CONFLICT_CONFIRMATION_REQUIRED`、`ASSESSMENT_VERSION_CONFLICT`、`ASSESSMENT_NOT_EDITABLE`、`INVALID_ASSESSMENT_RESULT`、`ASSESSMENT_FTP_NOT_APPLICABLE`、`FTP_VERSION_CONFLICT`、`IDEMPOTENCY_KEY_REUSED`。失败保留客户端输入；刷新测试后重新确认。幂等重放返回原响应，不表示资源未发生后续变化，客户端返回详情时应刷新。

`/assessments/:id/review-proposal` 保留原兼容入口；移动端使用选择阶段/日期的范围入口，避免固定强制替换一周。

既有测试在阶段归档或目标暂停后仍可改期，保留原关联，不据此创建新阶段；新测试需选择活跃目标和阶段。计划版本恢复也检查改期后的测试日期，不能借恢复覆盖测试日。
