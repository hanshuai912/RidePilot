# Redis 启动修复与统一专业编辑器验证

日期：2026-11-09。功能说明：[API 启动](../features/api-startup.md)、[课程编辑](../features/course-editing-preview.md)。需求变更：[统一专业模式](../changes/2026-11-09-professional-workout-editor.md)。

## 环境恢复

- 实际执行 `docker compose up -d --wait postgres redis`，两项依赖均 healthy。
- `docker compose exec -T redis redis-cli ping` 返回 `PONG`。
- `curl --max-time 3 --silent --show-error --fail http://127.0.0.1:3000/api/v1/health` 返回 `status:ok`、database/redis 均 `ok`。
- 随后用户报告 3000 冲突并授权停止占用者。`docker ps --filter publish=3000` 定位到 `ridepilot-api-1` 容器，实际执行 `docker compose stop api`；`ss -ltnp 'sport = :3000'` 确认无监听。
- PostgreSQL/Redis 继续 healthy，API 容器已停止；宿主机可重新执行 `pnpm dev:api`。

## 回归命令

沿用已安装依赖的本地二进制，不新增依赖、迁移或环境配置键。

- 根目录：`./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`、`./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`、`./node_modules/.bin/tsc -p apps/api/tsconfig.build.json`。
- 根目录：`./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`。
- mobile 目录：`./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint src app`。
- mobile 定向：`./node_modules/.bin/jest --runInBand --silent src/features/training/__tests__/workout-enhancements.test.tsx src/features/training/__tests__/training-routes.test.tsx`：2 suites、48 tests 通过。
- API 定向：`./node_modules/.bin/jest --runInBand --silent test/redis.service.spec.ts test/health.e2e-spec.ts`：2 suites、6 tests 通过。
- API 目录：`node /tmp/ridepilot-startup-integration.cjs`；临时运行器加载 `.env.test`，保留本机 `_test` 数据库及 Redis DB 1 检查，执行本地 `prisma migrate deploy`、`jest --runInBand --silent`。17 个既有迁移无待应用项。日志 `/tmp/ridepilot-api-professional.log`。
- mobile 全量：`./node_modules/.bin/jest --runInBand --silent`。日志 `/tmp/ridepilot-mobile-professional.log`。

## 已完成检查

- contracts、API、mobile TypeScript 检查通过。
- API 构建通过；oxlint 与 mobile ESLint 通过。
- 移动端全量 34 suites、311 tests 通过。
- API 全量 43 suites、288 tests 通过；1 个真实模型 smoke suite/test 按配置跳过（总计 44 suites、289 tests）。
- 本次修改文件的 Prettier 检查及 `git diff --check` 通过。

## 真实启动失败验证

API 目录执行 `node /tmp/ridepilot-startup-smoke.cjs`，以编译后的 `dist/main.js` 启动独立子进程，仅连接本地测试数据库，将该子进程 Redis 指向临时未监听端口；不停止现有 Redis，不修改仓库 `.env`。

实际结果：5.163 秒退出，状态码 1；输出包含 `ECONNREFUSED` 和 `docker compose up -d --wait postgres redis` 修复命令；没有 ioredis `Unhandled error event`、未处理的 Promise 拒绝或 `Connection is closed` 堆栈。日志 `/tmp/ridepilot-startup-refused.log`。

## 验收边界

编辑器测试确认完整目标/强度/重复次数直接显示、没有模式切换或简洁比例调整，排序不改写动作参数，仍可进入逐项编辑。人工课程及 AI 候选入口复用同一组件，现有未保存、冲突、校验与确认应用测试继续保留。

本次未执行真机/模拟器视觉验收及真实模型 smoke。
