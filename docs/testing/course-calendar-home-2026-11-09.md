# 课程编辑、预览、首页与日历验证

日期：2026-11-09。本记录为最初实现时的验证快照；随后已按用户要求取消双视图，当前验收见 [专业模式与启动修复验证](api-startup-professional-editor-2026-11-09.md)。关联功能：[编辑与预览](../features/course-editing-preview.md)、[日历与改期](../features/training-calendar-reschedule.md)、[首页](../features/mobile-home.md)。

## 环境与命令

使用已安装 workspace 依赖，未新增包。当前 `pnpm` 运行器报 `unable to open database file`，因此直接使用仓库 `node_modules/.bin` 下的相同工具。

- `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`：构建共享契约。
- `./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`；mobile 目录 `./node_modules/.bin/tsc --noEmit`。
- `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`；mobile 目录 `./node_modules/.bin/eslint src app`。
- mobile 目录 `./node_modules/.bin/jest --runInBand --silent`。
- API 测试加载 `apps/api/.env.test`，保留原集成运行器“本地 PostgreSQL、数据库名 `_test` 后缀、Redis DB 1”保护，直接执行 `prisma migrate deploy` 和 `jest --runInBand --silent`。默认 Redis 端口被占用且认证不匹配，使用本次独立 Redis 实例 `127.0.0.1:16379/1`，未修改仓库环境配置。临时运行器 `/tmp/ridepilot-integration.cjs`；输出不记录凭据。

已有 17 个迁移均已应用，本任务无新增 migration。测试使用独立测试账号，清理其数据。未访问生产数据库。

## 覆盖

- 动作排序、视图切换共享草稿，偏好持久化不改变训练资料版本；时间/距离和功率单位保留，重复次数计入汇总，越界调整原子拒绝。
- AI 局部编辑保留其他课程，保存只形成新草稿修订，版本冲突保留输入；重新校验与确认前不发布，应用携带预览版本；新生成调整保存详细旧课程快照。
- 单节详细参数比较，后续日期范围有效性与二次确认，范围生成后进入完整预览。
- 月视图跨年、月末钳制，休息/恢复与未安排区别，测试/赛事并存；账号时区定位今天。
- 改期归属/未登录/过期版本保护；同日多课程预算、距离目标未知时长、比赛/测试/固定休息冲突；替代日期；预览后出现新冲突时阻止发布且事务回滚；新序号、幂等与不确定响应重试。
- 首页真实状态依据、下一测试/比赛和建议路由，部分失败、缓存及跨日刷新保护。

## 执行结果

- 定向移动端：3 suites、61 tests 通过。
- 定向 API（含真实测试数据库）：5 suites、35 tests 通过。
- API 全量（含真实测试数据库）：42 suites、287 tests 通过；1 个 live smoke suite/test 按配置跳过。
- contracts、API、mobile TypeScript 检查通过；oxlint 通过；API `tsc -p apps/api/tsconfig.build.json` 构建通过。
- 移动端最终全量：34 suites、312 tests 全部通过；ESLint 通过，无警告。
- `git diff --check` 通过；所有本次修改文件的 Prettier 检查通过。
- 实际最终命令：API 目录 `node /tmp/ridepilot-integration.cjs`（内部执行本地 `prisma migrate deploy`、`jest --runInBand --silent`），mobile 目录 `./node_modules/.bin/jest --runInBand --silent`。
- 测试完成后已停止本次启动的 PostgreSQL 与独立 Redis，未改动默认端口上的其他 Redis 服务。

## 手工验收

1. 编辑包含重复动作与距离目标的课程，上下排序、切换视图，检查参数不变；调整时长并看结构图，保存正式课程。
2. 在 AI 预览进入局部编辑，只改一节再保存，重新预览/校验/确认；另一设备修改同草稿时显示冲突。
3. 单节调整选择后续范围，取消确认不发生成请求；确认后核对旧/新安排及全部替换课程。
4. 切月视图并选跨月日期，区分固定休息、恢复和未安排；进入课程改期，选择有比赛日期，再选推荐日期并确认。
5. 有近期疲劳反馈时打开首页，检查状态解释、下一测试/赛事及待确认建议；断网刷新显示明确错误而非空安排。

本次未执行真机/模拟器视觉与手势验收，未运行真实模型 live smoke；自动测试中的模型使用受控 fixture。
