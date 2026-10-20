# 注册、登录与默认鉴权

## 1. 目的与范围

实现 PRD V1.3 的测试阶段手机号注册、密码登录、会话刷新、退出及后续 API 默认鉴权。移动端 P01 欢迎、注册、登录页面现已接入同一契约。测试验证码不发送短信，也不证明手机号归属。

## 2. 用户流程

注册提交手机号、6 位数字测试验证码、密码和确认密码；服务端校验后创建独立用户 ID、未验证的手机号凭据和首个会话，并返回令牌对。登录用手机号和密码取得新会话。客户端用 Refresh Token 轮换令牌；退出撤销当前会话。格式错误、重复手机号、密码错误、令牌失效和限流都有明确错误响应。

## 3. 技术实现

- `packages/contracts/src/auth.ts`：请求/响应 Zod 契约及密码规则。
- `apps/api/src/modules/auth/`：Controller、Service、Repository、密码哈希、令牌、限流与全局守卫按职责拆分。
- `apps/api/src/common/zod-body.pipe.ts`：服务端请求体验证。
- `apps/api/prisma/schema.prisma`：用户、手机号凭据、认证会话模型。
- `apps/api/src/config/env.ts`：JWT 密钥与测试验证码开关校验。
- `apps/api/src/configure-app.ts`：CORS 预检与浏览器允许来源。开发模式允许本地 Expo Web 访问；生产模式仅允许 `CORS_ALLOWED_ORIGINS` 中配置的来源，未配置则不开放浏览器跨域访问。
- `apps/mobile/app/_layout.tsx`：启动认证状态检查与路由保护。
- `apps/mobile/src/features/auth/`：页面、表单、API 请求、会话恢复和令牌存储。

密码、确认密码及原始 Refresh Token 不进入日志或数据库；数据库只存密码的 scrypt 哈希和刷新令牌哈希。认证与会话取舍见 [ADR 0002](../adr/0002-authentication.md)。

## 4. API 契约

接口及状态码见 [认证 API](../api/auth.md)。注册、登录、刷新显式公开；退出要求有效 Access Token。后续 Nest 业务路由默认受全局守卫保护，并在服务层检查资源归属。

## 5. 数据与迁移

迁移和索引见 [认证数据模型](../data/authentication.md)。注册为事务写入；手机号唯一约束保证不会出现两个相同手机号账号。刷新以旧令牌哈希进行条件更新，只有一个并发请求可成功。退出按会话撤销；已有训练等业务数据不受本迁移影响。

## 6. UI 状态与交互

P01 采用 `RidePilot_UI/design/screens/P01-welcome.html`、`P01-login.html`、`P01-register.html` 的暗色布局与文案结构。认证页使用 `auth.css` 对应的局部色值及显式字号/行高，不继承通用文本组件的默认排版。未登录启动直接进入登录页；页面返回可进入欢迎页，欢迎页提供注册和登录入口。三页无底部导航。表单通过共享 Zod 契约和 React Hook Form 校验；提交中禁用按钮，错误保留输入并显示文字反馈；测试验证码明确不发送短信。注册成功进入现有首页，建档向导尚未实现，因此注册按钮不承诺立即建档。

Android/iOS 的 Refresh Token 存在 Expo SecureStore；Access Token 仅在内存中保存。启动时读取 Refresh Token 并调用 `/auth/refresh` 验证及轮换；无令牌或令牌失效进入登录，网络故障显示重试状态，避免把不确定会话当作已登录。临近 Access Token 到期时再次刷新。退出请求服务端撤销当前会话，成功后清除本地令牌；Access Token 已过期时先刷新再退出。开发用 Web 预览将 Refresh Token 存在浏览器 `sessionStorage`，同一标签页刷新时可恢复登录，关闭标签页即结束本地会话。浏览器脚本可访问该存储；如需正式发布 Web 客户端，应改用服务端 HttpOnly Cookie 会话方案。

## 7. 错误、安全与边界

密码规则：至少 6 个字符，且大写字母、小写字母、特殊符号三类中至少两类；数字不计入类别。手机号暂按 11 位数字、特殊符号暂按可见 ASCII 标点符号校验，属于 PRD 建议方案，待最终确认。登录失败不区分手机号不存在与密码错误。Redis 对认证请求限流；测试验证码注册在生产默认关闭。手机号验证状态始终为 `UNVERIFIED`。

## 8. 测试与验证

`apps/api/test/auth-policy.e2e-spec.ts` 覆盖密码、验证码和确认密码边界。`apps/api/test/auth.e2e-spec.ts` 在独立 PostgreSQL 测试库和 Redis DB 1 验证注册、重复手机号、登录、令牌轮换、并发刷新、退出、未授权和限流；测试结束清理创建的账号。

移动端 `apps/mobile/src/features/auth/__tests__/` 覆盖欢迎入口、登录和注册表单校验、登录错误、启动会话恢复、失效令牌和离线状态、退出，以及 Web 会话存储在模块重新加载后的读取与清除。运行 `pnpm --filter @ridepilot/mobile test`、`typecheck`、`lint`。本地 API 地址通过 `EXPO_PUBLIC_API_URL` 配置，见仓库 README。

`apps/api/test/cors.e2e-spec.ts` 通过真实 Nest HTTP 预检请求验证 `Authorization` 与 JSON 请求头可跨域使用。已执行 `pnpm --filter @ridepilot/api test --runTestsByPath test/cors.e2e-spec.ts`，1 个用例通过；API 类型检查和本次改动的 oxlint 均通过。移动端 3 个测试套件、9 个用例通过，移动端类型检查、lint 和 Web export 通过；后者输出到临时目录，不纳入仓库。

2026-10-20 真机验证：在连接的 Android 设备 PKT110 上，使用 Temurin JDK 17 执行 `expo run:android`，Gradle `app:assembleDebug` 成功，随后因本机 Metro 文件监听上限导致 CLI 自动安装中断；使用 `adb install -r` 安装新 APK 成功。ADB 冷启动显示登录页，登录页可进入注册页，进程日志无 `ExpoSecureStore` 缺失错误。空密码中文文案的自动化测试已通过；真机加载新 JS 时 Metro 清缓存打包停在 99%，该文案尚未完成真机复验，最终将手机调试地址恢复到原可用服务并确认登录页重新显示。未使用真实账号进行登录或注册写入测试。

已执行 `pnpm --filter @ridepilot/api test:integration`，测试库迁移成功，4 个测试套件、22 个测试通过。`pnpm --filter @ridepilot/api db:deploy` 已将同一迁移应用到开发库，`prisma migrate status` 报告数据库结构与迁移一致。开发模式在 3001 端口启动后，健康接口返回 200、未带令牌的退出接口返回 401；OpenAPI JSON 包含四个认证路径与 Bearer 方案。使用 `NODE_ENV=production AUTH_TEST_CODE_ENABLED=false` 启动时，测试验证码注册返回 503，健康接口仍返回 200。`docker compose build api` 成功，临时容器在 3002 端口返回健康接口 200、未授权退出 401、Swagger 页面 200，验证后已清理。类型、lint、格式和构建检查均已执行通过。

## 9. 变更记录与未决问题

- 2026-10-09：新增测试阶段认证与全局鉴权。
- 2026-10-19：接入移动端 P01 欢迎、注册、登录、启动鉴权与退出；沿用现有 API、共享契约和数据库，无接口或迁移变更。
- 2026-10-19：为浏览器预检启用 CORS，Compose 透传生产环境允许来源配置；无数据库变更。
- 2026-10-19：修复 Web 刷新掉线：原实现仅在内存保存 Refresh Token，改为同标签页 `sessionStorage`，刷新后轮换令牌恢复会话；后端数据库和 Redis 配置无变更。
- 2026-10-19：Android/iOS 脚本改为构建并安装原生开发包，确保新增 SecureStore 等原生模块进入手机二进制；旧开发包仅刷新 JS 会报 `Cannot find native module 'ExpoSecureStore'`。保留 `android:metro` / `ios:metro` 作为仅启动 Metro 的命令。
- 2026-10-20：真机验证 Android 新包包含 SecureStore，冷启动显示登录页、注册入口可打开；修正空登录密码的英文默认校验文案。Android 本地构建需 JDK 17，本次使用已下载的 Temurin 17 完成构建。
- 2026-10-20：修复真机本地 API 默认地址：开发模式优先取 Expo Metro 的主机 IP，与 API 的 3000 端口组合；`EXPO_PUBLIC_API_URL` 仍可显式覆盖。原固定 Android 默认 `10.0.2.2` 仅适用于模拟器，真机连接会超时。未变更 API 服务监听、接口或数据库。
- 本次地址解析变更已新增 3 个移动端测试用例；按用户要求由用户自行测试，本轮未完成运行验证。手机在排查期间已断开 ADB，未进行新的真机请求验证。
- 2026-10-20：进一步确认手机浏览器可访问 `http://192.168.0.73:3000/api/v1/health`，API 在 `0.0.0.0:3000` 监听；当时运行的 Metro 进程未设置 `EXPO_PUBLIC_API_URL`，且移动端无 `.env.local`。已在本机忽略提交的 `.env.local` 中写入该局域网 API 地址；需重启 Metro 并由用户复验。未修改 API 服务配置。
- 待产品确认：目标国家/地区与手机号规则、特殊符号范围、真实短信验证和旧账号迁移。
- 未实现：初次建档向导、真实短信发送、手机号归属验证；正式 Web 会话方案未开放。
