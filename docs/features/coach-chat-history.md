# 问 AI 教练：聊天布局与历史记录

## 目的与范围

将独立「问 AI 教练」页面改为连续聊天：用户气泡在右，教练气泡在左，输入栏固定在底部。沿用 `RidePilot_UI/AGENTS.md` 的黑金暗色规范。按账号保存一条连续对话，重新进入或重启 App 后读取服务端记录。暂不提供多个会话、附件、语音或流式回答。

原页面只在内存保存消息，无法追溯本功能上线前已经丢失的聊天。

## 用户流程与状态

- 教练首页右上角消息入口进入，顶部返回教练首页；深层页面隐藏 Tab Bar。
- 首次加载读取最新 20 轮，进入后定位最近消息；向上翻阅并通过「查看更早消息」继续读取，每次 20 轮，无总历史条数截断。
- 输入最多 500 字，支持多行；接近限制时展示字数。发送立即显示问题并清空输入，显示「正在回复…」。等待期间可编辑下一条草稿，上一条结束前禁用再次发送。
- 用户问题使用深金灰气泡，教练使用石墨灰气泡；正文 16、辅助信息 12–13，正文可选择复制。长列表使用虚拟化。
- 固定输入栏和消息列表同处 `KeyboardAvoidingView`，输入栏是列表的兄弟节点。iOS 使用 padding，Android 使用 height；顶部安全区作为垂直偏移。键盘出现时去掉底部设备安全区留白，输入栏随键盘上移，输入控件下方仅保留 4pt 间距（原为 12pt）；收起后恢复安全区，至少保留 12pt。聚焦输入定位最近消息，翻阅历史时后台更新不强制跳到底部。
- 首次读取失败提供重试，未知历史期间禁止发送；更早记录失败保留已有消息并可重试。未登录显示提示且禁用发送。
- 回复失败在原消息位置显示错误和重试按钮，复用原消息标识和最新版本。断网时当前页面保留问题，重试按同一标识核对服务端结果；服务端收到的问题及回答可以恢复。完全离线且尚未到达服务端的问题不承诺跨重启恢复。
- 处理中返回页面继续轮询该消息。轮询仅在页面聚焦时进行，离开不取消后端回答；进程中断后，租约到期显示失败，可显式重试。轮询失败保留对话并提示重试同步。

## 实现与模块

- `apps/mobile/src/features/coach/screens/CoachChatScreen.tsx`：页面、安全区、键盘和消息列表装配。
- `components/CoachChatTurn.tsx`、`CoachChatComposer.tsx`、`coach-chat.styles.ts`：消息、输入栏和样式。
- `hooks/useCoachChat.ts`：分页、账号切换清空、发送、幂等重试及回复恢复。
- `services/coach-center.api.ts` 与 `packages/contracts/src/coach-chat.ts`：API 和 Zod 契约。
- `apps/api/src/modules/coach/coach-chat-history.service.ts`：持久化编排，复用现有只读 `CoachChatService`。
- `coach-chat.repository.ts`：归属校验、分页、事务、去重与尝试租约。

## API 与权限

| 方法 | 路径（`/api/v1`）                          | 行为                                                           |
| ---- | ------------------------------------------ | -------------------------------------------------------------- |
| GET  | `/ai-coach/chat/messages?before=<turnId>`  | 本人最新/更早 20 轮，返回 `turns` 与 `nextCursor`，倒序        |
| GET  | `/ai-coach/chat/messages/:clientMessageId` | 按本人客户端标识恢复一轮，返回 `{turn}`，不存在时 turn 为 null |
| POST | `/ai-coach/chat/messages`                  | `{clientMessageId,message,expectedVersion}`，返回该轮完整状态  |

所有接口使用现有 JWT 鉴权。before 必须属于当前用户，否则 404；恢复按当前用户与客户端标识联合查询。状态为 PROCESSING / COMPLETED / FAILED。返回问题、回答、时间、错误文案及版本；不返回账号 ID、内部尝试 ID 或租约。

POST 受理后的模型失败以 FAILED 轮次返回，HTTP 201 不代表回答成功；客户端按状态展示。非法输入 400；同标识更换问题、失败重试版本不符或另有回答处理中返回 409。保留原 `/ai-coach/chat` 接口兼容旧调用，该接口仍是无持久化问答。

## 数据、事务与兼容

新增 `CoachChatTurn` / `coach_chat_turns` 与枚举；迁移 `20261112090000_coach_chat_history` 为新增式迁移。外键指向 User，删除账号级联删除聊天；联合唯一键 `(user_id, client_message_id)` 防止重复问题，索引 `(user_id, created_at, id)` 支持稳定分页，同时间通过 UUID 排序。

请求使用用户行锁原子认领，完成保存也使用同一行锁。模型调用在事务之外；同账号同时间仅允许一轮有效处理中请求。重复成功请求返回已有回答，处理中请求返回已有轮次，不再调用模型。失败重试检查 expectedVersion，更新 attemptId 和 version。完成校验 attemptId，旧尝试不能覆盖新尝试。租约为 `2 × AI_TIMEOUT_MS + 60 秒`，覆盖模型超时并允许崩溃恢复；GET 将到期 PROCESSING 展示为可重试 FAILED，不触发模型或修改计划。

模型只参考当前问题之前最近三轮已完成对话；历史记录总量与模型上下文独立。仍要求正式训练计划，计划变更保留原草稿、预览、校验和确认流程。仅保存公开错误提示，不保存上游诊断或模型思考文本。

部署先运行 `pnpm db:generate`，在目标数据库执行 `pnpm --filter @ridepilot/api db:deploy`，再部署 API 与移动端。旧客户端仍可用原接口。回退应用可保留新表，不直接删除已产生聊天。

## 测试与验证

`apps/mobile/src/features/coach/__tests__/coach-chat.test.tsx` 覆盖历史恢复、账号切换、即时消息、重复发送、下一条草稿、同消息重试、丢失响应对账、分页失败、处理中轮询、登录和两平台键盘容器及安全区切换。

`apps/api/test/coach-chat-history.e2e-spec.ts` 使用隔离数据库和模型 stub，覆盖鉴权、输入校验、持久化、用户隔离、稳定分页、三轮上下文、幂等、并发、版本冲突、失败重试及过期尝试隔离。

本次实际验证：

- `pnpm db:generate`：Prisma 客户端生成成功。
- `node /tmp/ridepilot-chat-check.cjs development`：读取 `apps/api/.env` 并校验本机非 production 数据库，执行 Prisma `migrate deploy` 和 `migrate status`。`ridepilot` 已应用新迁移，19 个迁移全部同步；无删除数据操作。
- `node /tmp/ridepilot-chat-check.cjs integration`：读取 `.env.test`，严格校验本机 `*_test` 数据库和 Redis DB1，应用迁移并运行聊天历史、教练中心两组集成测试，17 项通过。模型为 stub。
- 移动端 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/coach-chat.test.tsx`：9 项通过，覆盖两平台键盘显示和隐藏时容器尺寸及安全区恢复。教练中心单独回归 19 项通过。
- 移动端 `./node_modules/.bin/jest --runInBand`：43 组通过，1 组失败；386 项通过、10 项跳过、3 项失败。失败均位于 `goal-planning.test.tsx`，涉及目标切换和阶段展开。用 `git archive HEAD` 建立修改前隔离副本 `/tmp/ridepilot-before-chat`，执行同一目标测试后复现相同 3 项失败（基线 23 项通过），本次没有修改这些业务或测试。
- `node /tmp/ridepilot-chat-check.cjs all`：后端全量含数据库回归 46 组通过、2 组失败、1 组跳过；315 项通过、2 项失败、1 项跳过。失败为 `plan-input-impact.e2e-spec.ts` 的阶段提示文案断言和 `assessments.e2e-spec.ts` 的测试结果变化阻断断言。`node /tmp/ridepilot-baseline-api.cjs` 在修改前隔离副本复现相同 2 项失败（基线 17 项通过）。基线输出为 `/tmp/ridepilot-baseline-api.json` 和 `/tmp/ridepilot-baseline-goals.json`。
- 根目录 `./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`、`./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`、`./node_modules/.bin/tsc -p apps/api/tsconfig.build.json` 以及移动端 `./node_modules/.bin/tsc --noEmit`：通过。
- 根目录 `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src` 与移动端 `pnpm --filter @ridepilot/mobile lint`：执行；后者初次发现测试的未使用导入，移除后对所有本次移动端文件执行 `./node_modules/.bin/eslint ...` 通过，无警告。格式与 diff 检查通过。
- 移动端 `node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-chat-web --max-workers 2`：3862 模块导出成功。
- `node /tmp/ridepilot-chat-browser.cjs`：浏览器加载实际导出页面、拦截 API 使用合成账号和消息，检查 320/390/430 宽度、输入栏贴底、列表边界、左右消息、发送后刷新恢复、缩小视口后输入栏位置与页面无脚本错误，通过。截图 `/tmp/ridepilot-chat-320.png`、`-390.png`、`-430.png`。

本机 `adb devices` 无可用设备，未完成 Android/iOS 真机软键盘或真实模型端到端验证；组件测试和 Web 视口变化不能替代真机检查。

## 输入框与键盘间距微调

键盘展开时底部内边距从 12pt 缩至 4pt；收起后的安全区处理不变。本次执行移动端 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/coach/__tests__/coach-chat.test.tsx`（9 项通过）、`./node_modules/.bin/tsc --noEmit`、针对页面与测试文件的 ESLint，以及 Prettier 和 `git diff --check`，均通过。两平台组件测试确认展开时为 4pt、收起恢复安全区；未执行真机验证。
