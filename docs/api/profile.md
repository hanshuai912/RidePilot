# 用户信息 API

统一心率设置是独立资源，见 [心率区间 API](heart-rate.md)，不通过个人信息 POST 更新。

接口前缀为 `/api/v1`，所有请求都需要 `Authorization: Bearer <accessToken>`。接口只使用当前令牌中的用户 ID，不接受路径用户 ID。

## GET `/me/profile`

返回当前账户的页面昵称、脱敏手机号、手机号验证状态、性别、出生日期、身高、体重、训练经验、时区、语言地区和档案版本。未建立档案时，昵称为“骑行者”，性别/出生日期/身高/体重/训练经验为空。时区仅供训练日期计算使用，不属于个人资料可编辑字段。响应不包含密码或密码哈希。

## POST `/me/profile`

只更新请求中显式出现的允许字段，未出现字段保持不变。可更新：`displayName`、`gender`、`birthDate`、`heightCm`、`weightKg`、`experienceLevel`。传 `null` 可清空支持空值的档案字段；昵称清空后展示“骑行者”。出生日期使用 `YYYY-MM-DD` 格式。

`userId`、手机号、验证状态、密码及密码哈希不是允许字段；未知字段也会被拒绝。`expectedVersion` 可选，提交时若与当前版本不一致返回 409 `PROFILE_VERSION_CONFLICT`。成功后版本递增并返回完整最新档案。

性别选项为 `MALE`、`FEMALE`、`OTHER`、`PREFER_NOT_TO_SAY`；经验为 `BEGINNER`、`INTERMEDIATE`、`ADVANCED`。这些值来自当前 PRD 建议口径，性别暂不参与训练或营养计算。训练时区和课程显示偏好不通过本接口写入。FTP 历史、训练时段、饮食禁忌和正式目标不通过本接口写入。
