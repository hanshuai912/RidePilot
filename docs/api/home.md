# 首页聚合 API

`GET /api/v1/home/today`，需要 `Authorization: Bearer <access-token>`。首页每次加载或刷新仅调用此接口，不在客户端分别请求个人资料、计划状态、日历、下一节和营养接口。

服务端使用当前鉴权用户的账号时区计算 `localDate`；不接受用户 ID 或日期参数来改变查询归属及日期。

## 响应

```json
{
  "localDate": "2026-10-30",
  "profile": {
    "userId": "00000000-0000-4000-8000-000000000001",
    "displayName": "骑行者",
    "timezone": "Asia/Shanghai"
  },
  "training": {
    "status": "READY",
    "data": {
      "plan": { "hasActivePlan": false, "planVersion": 0 },
      "calendar": {
        "from": "2026-10-30",
        "to": "2026-10-30",
        "ftpAvailable": false,
        "items": []
      },
      "nextWorkout": null
    }
  },
  "nutrition": {
    "status": "UNAVAILABLE",
    "error": {
      "code": "HOME_NUTRITION_UNAVAILABLE",
      "message": "饮食安排暂时无法读取，请重试"
    }
  }
}
```

共享 Zod 契约 `homeTodayResponseSchema` 定义真实结构。`training` 和 `nutrition` 都是 `READY + data` 或 `UNAVAILABLE + error` 的判别联合，独立报告读取结果；营养 READY 的数据结构沿用 `nutritionPlanResponseSchema`，训练 calendar/items 沿用课程摘要契约。无正式训练计划、今日无课程、无下一节、尚未生成饮食都属于 READY 的正常空数据。

鉴权失败返回 401；无法读取账号或确定时区则整个请求失败，不猜测日期。单个领域读取失败时 HTTP 200 返回部分结果，错误信息经过服务端归一化，不透出数据库或内部异常细节。两个领域都失败时也明确返回两个 UNAVAILABLE，客户端可整体重试。

训练状态、今日课程与下一节在服务端读取同一正式版本快照。训练和营养保持各自版本；日期一致不代表二者自动联动或一起发布。响应只带首页所需昵称、用户 ID、时区，不带完整身体档案或联系方式。

客户端同日刷新失败保留已显示内容并标为未更新，禁止基于过期训练数据执行写操作；跨日清除前一天缓存。返回首页、前台和跨日刷新仍使用同一个接口；错误区重试也重新请求聚合接口。
