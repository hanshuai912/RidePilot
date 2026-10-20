# RidePilot 项目目录

当前目录中的 `RidePilot_Product` 和 `RidePilot_UI` 是指向同级 Git 仓库的符号链接。直接打开 `RidePilot/`，就能在项目文件树中看到开发、产品与设计内容：

| 当前项目中的路径       | 仓库                                                                      | 用途               |
| ---------------------- | ------------------------------------------------------------------------- | ------------------ |
| `./`                   | [RidePilot](https://github.com/hanshuai912/RidePilot.git)                 | 开发规范与应用代码 |
| `./RidePilot_Product/` | [RidePilot_Product](https://github.com/hanshuai912/RidePilot_Product.git) | 产品需求与产品规范 |
| `./RidePilot_UI/`      | [RidePilot_UI](https://github.com/hanshuai912/RidePilot_UI.git)           | 设计规范与 UI 稿   |

三个实际仓库目录应位于同一父目录下。若尚未克隆产品或 UI 仓库，在 `RidePilot/` 的父目录执行：

```bash
git clone https://github.com/hanshuai912/RidePilot_Product.git
git clone https://github.com/hanshuai912/RidePilot_UI.git
```

两个链接指向 `../RidePilot_Product` 和 `../RidePilot_UI`。各仓库仍独立提交和推送，产品及 UI 文件的改动不会出现在当前仓库的 `git status` 中。`RidePilot/` 内按 [`agents/development/Agent.md`](./agents/development/Agent.md) 使用 pnpm monorepo。

## 后端本地开发

需要 Node.js 24、pnpm 11 和 Docker Compose。后端位于 `apps/api`，共享 API 契约位于 `packages/contracts`；移动端位于 `apps/mobile`。

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
pnpm install --frozen-lockfile
docker compose up -d postgres redis
pnpm db:generate
pnpm --filter @ridepilot/api db:deploy
pnpm dev:api
```

复制环境文件后，先分别用 `openssl rand -hex 32` 生成两段不同的随机值，填入 `JWT_ACCESS_SECRET` 与 `JWT_REFRESH_SECRET`。本地 API 读取 `apps/api/.env`，Compose 读取根目录 `.env`；示例文件中的密钥为空，未设置时 API 不会启动。

本地 API 地址为 `http://127.0.0.1:3000/api/v1/health`。开发时 PostgreSQL 和 Redis 在 Docker 中运行，API 在宿主机运行。也可使用 `docker compose up --build -d` 将 API 一并放入 Docker。已提交的 Prisma 迁移通过 `pnpm --filter @ridepilot/api db:deploy` 显式应用，不在容器启动时自动执行。

## 移动端本地认证

先启动上述本地 API，再启动 Expo：

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm --filter @ridepilot/mobile start
```

**手机提示 `Cannot find native module 'ExpoSecureStore'` 时**，运行中的原生 App 没有包含后来添加的 SecureStore。仅重启 Metro 或刷新 JS 无法加入原生模块。Android 设备连接开发机后，在 `apps/mobile` 执行 `pnpm android`（根目录执行 `pnpm --filter @ridepilot/mobile android`），重新构建并安装开发包；iOS 在 macOS 上执行 `pnpm ios`。安装过包含该模块的开发包后，日常 JS 调试仍使用 `pnpm start`。`android:metro` / `ios:metro` 只启动打包服务，不重建原生包。若使用 Expo Go，则应使用支持当前 Expo SDK 57 的版本；SecureStore 已包含在对应版本的 Expo Go 中。

Android 本地构建需将 `JAVA_HOME` 指向 JDK 17，并配置 `ANDROID_HOME`。如果 Metro 报 `EMFILE: too many open files, watch`，可临时使用 `CI=1 pnpm --filter @ridepilot/mobile start` 关闭热更新文件监听；代码修改后需重启该服务。真机使用 USB 转发连接本地 API 时，设置 `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000/api/v1`，并执行 `adb reverse tcp:3000 tcp:3000`；设备重新连接 USB 后需要重新执行转发。

开发模式未显式设置 `EXPO_PUBLIC_API_URL` 时，App 会使用当前 Metro 的主机 IP 连接同一电脑的 3000 端口；例如 Metro 是 `192.168.0.73:8081`，API 就用 `http://192.168.0.73:3000/api/v1`。如果 Metro 主机地址不可用，Android 模拟器回退到 `10.0.2.2`，其他平台回退到 `localhost`。也可以显式设置 `EXPO_PUBLIC_API_URL` 覆盖默认值，且地址必须包含 `/api/v1`。真机和电脑须处于可互通的网络；修改环境变量后重新启动 Expo。注册测试验证码为任意 6 位数字，本地 API 须开启 `AUTH_TEST_CODE_ENABLED=true`。

**连接 Metro 的 IP 与 API 请求地址是两项配置。** 真机登录超时而手机浏览器能打开 API 健康接口时，检查 `apps/mobile/.env.local` 是否设置 `EXPO_PUBLIC_API_URL=http://<电脑局域网 IP>:3000/api/v1`，再完全停止并重启 Metro；仅刷新手机页面不会替换已打包进 JS 的旧环境变量。电脑 IP 改变后也要同步修改此文件。

Expo Web 跨域请求由 API 的 CORS 配置处理。宿主机开发模式默认允许浏览器来源；如通过 Compose 启动 API，其 `NODE_ENV=production`，需在根目录 `.env` 的 `CORS_ALLOWED_ORIGINS` 填写 Web 页面的完整 Origin，例如 `http://localhost:8081`（不含 `/api/v1`）。多个来源用逗号分隔。修改后重启 API 容器。

未登录时启动直达登录页；登录或注册页顶部返回按钮可进入欢迎页。注册成功暂进入现有首页，初次建档向导尚未开发。Android/iOS 的 Refresh Token 存于 Expo SecureStore；开发用 Web 预览存于浏览器 `sessionStorage`，同一标签页刷新后通过 API 恢复登录，关闭标签页后需重新登录。详见 [移动端认证实现](./docs/features/authentication.md)。

当前测试阶段的注册接口接受任意 6 位数字验证码，**不会发送短信，也不会把手机号标记为已验证**。本地开发将 `AUTH_TEST_CODE_ENABLED` 设为 `true`；实际生产部署必须设为 `false`，在真实短信验证流程完成前不可开放此注册方式。注册、登录和刷新公开；退出以及后续业务 API 默认要求 Bearer Access Token。接口详情见 [认证 API](./docs/api/auth.md)。

Swagger 页面：`http://127.0.0.1:3000/api/docs`；OpenAPI JSON：`http://127.0.0.1:3000/api/docs-json`。本地开发默认开启 Swagger，Compose 开发环境通过 `SWAGGER_ENABLED=true` 开启；生产环境默认关闭，可按部署需求显式配置。

根目录 `.env` 供 Compose 读取，`apps/api/.env` 供本地 API 与 Prisma CLI 读取。示例密码只用于本机开发，部署时应使用环境专属密钥，并通过环境变量注入。PostgreSQL、Redis 和 API 的宿主机端口均绑定至 `127.0.0.1`。数据保存在 Compose 卷中；`docker compose down` 不删除数据卷。

认证集成测试使用独立的 `ridepilot_test` 数据库和 Redis DB 1。首次运行时创建测试库并复制测试环境示例，然后执行：

```bash
docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" ridepilot_test'
cp apps/api/.env.test.example apps/api/.env.test
pnpm --filter @ridepilot/api test:integration
```

`createdb` 只需执行一次。测试命令会将迁移应用到测试库，运行后清理自己创建的账号。

质量检查：

```bash
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose config
```

架构和边界见 [后端基础设施文档](./docs/features/backend-foundation.md)及[认证功能文档](./docs/features/authentication.md)。
