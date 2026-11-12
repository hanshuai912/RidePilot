# FTP 编辑与骑行功率区间

## 目的与入口

“我的”页面将 FTP 功率、心率区间和第三方 App 入口合在同一张卡片中，以细分隔线区分三行。FTP 行只展示图标、标题、已保存瓦数和箭头；未填写显示“去填写”，读取失败显示“读取失败”。不展示最近测量时间、来源或录入方式。点击跳转受登录保护的 `/cycling-power-zones` 独立页面，隐藏底部五栏导航。

## 页面与交互

- 顶部固定为左侧返回箭头、中间 17 pt“骑行功率区间”、右侧金色文字“保存”；左右各 44 pt 操作区域以保持标题居中。
- 中间独立滚动：石墨灰 FTP 输入卡片、功率区间标题和 7 区列表；沿用主题颜色、18 pt 卡片圆角、分隔线和间距。每行展示区间编号、名称、百分比与等宽数字瓦数。
- 输入有效的 50–800 W 整数后立即换算区间；未填写或非法输入只展示百分比与“— W”，不显示伪造的瓦数。
- 移除底部保存栏，保存统一放在固定标题栏右侧，触控区域至少 44×44 pt；内容仍保留底部安全区。未修改、改回原值或输入非法时禁用；有有效修改才可保存。iOS 键盘通过 `KeyboardAvoidingView` 避让。
- 返回有未保存修改时提供“继续编辑”和“放弃修改”；保存期间禁用输入与返回，并拦截重复请求。网络失败保留输入，初次加载失败提供重试，禁止把加载失败当作首次空值。
- 保存成功回到“我的”，重新聚焦后读取最新 FTP；个人信息页复用相同的固定头部、滚动内容和固定保存布局。

## 7 区规则

沿用骑行知识库 `apps/api/skills/cycling-training/references/power-zones.md` 的主要分界 55/75/90/105/120/150%，使用连续边界明确整数瓦数归属。区间名称参考 [Andrew Coggan 的功率分区说明](https://www.trainingpeaks.com/blog/power-training-levels/)。原始说明的 Z7 不规定固定 FTP 百分比；本页面使用 >150% 作为冲刺参考展示，明确提示实际以个人短时最大功率为准，不宣称它是测得的神经肌肉能力上限。

| 区间 | 名称         | 本页面百分比边界 | FTP 200 W 时 |
| ---- | ------------ | ---------------- | ------------ |
| Z1   | 主动恢复     | ≤55%             | 0–110 W      |
| Z2   | 有氧耐力     | >55% 至 75%      | 111–150 W    |
| Z3   | 节奏         | >75% 至 90%      | 151–180 W    |
| Z4   | 乳酸阈值     | >90% 至 105%     | 181–210 W    |
| Z5   | 最大摄氧量   | >105% 至 120%    | 211–240 W    |
| Z6   | 无氧能力     | >120% 至 150%    | 241–300 W    |
| Z7   | 神经肌肉功率 | >150%，冲刺参考  | ≥301 W       |

上限按 `floor(FTP × 百分比 / 100)` 计算，下一段下限为上一段上限 + 1 W，保证整数瓦数无空档、无重叠；Z7 无固定上限。这些范围用于资料中的参考展示，不会重写已有训练课程、改变历史强度或自动应用新计划。

## 实现与数据

- `app/cycling-power-zones.tsx`：路由壳；根 Stack 在登录保护范围内注册。
- `screens/CyclingPowerZonesScreen.tsx`：页面装配；`components/FtpPowerZones.tsx`：七区列表；`components/FtpMeasurementCard.tsx`：概览入口。
- `model/power-zones.ts`：唯一的本页分区定义、输入解析和纯计算。
- `hooks/useFtpEditor.ts`：读取、草稿、校验、写入和错误状态；`useProfileEditorNavigation.tsx`：未保存及保存期间的离开保护。
- `ProfileEditorPage.tsx`、`ProfilePageHeader.tsx`：与个人信息页复用固定导航、独立滚动、固定保存和安全区布局。
- 复用 `coachApi.ftp` 与 `coachApi.addFtp`，继续调用 `GET/POST /api/v1/me/ability-measurements/ftp`，页面保存只传 `valueWatts` 与 `source: MANUAL`。每次保存追加测量历史；前端阻止同一请求期间的重复点击。
- POST 的 `measuredAt` 可省略，表示当前测量，由后端取得用户锁后使用服务器当前 UTC 时间，避免设备时钟快于服务器导致正常保存报 `FTP_DATE_IN_FUTURE`。显式传入历史测量时间时保留原值，显式未来日期仍返回 400，非法日期或 null 不会回退为当前时间。响应的 `measuredAt` 始终必填；最新 FTP 仍按测量时间排序。
- Swagger 与共享 Zod 契约同步；已有客户端显式传入合法日期仍兼容，发生时钟偏差的旧客户端需要刷新后使用新保存逻辑。数据库、鉴权及原生依赖不变，不需要数据库迁移或重新打开发包。后端现有归属校验及 AI 草稿 FTP 版本校验继续生效。

## 验证

- `./node_modules/.bin/jest --runInBand`（`apps/mobile`）：17 个套件、125 项通过，包括既有个人信息返回保护回归。
- `power-zones.test.ts`：遍历 50–800 W 所有有效整数 FTP，验证七区连续边界；覆盖 193 W 的舍入、非法值、输入上下限。
- `ftp-power-zones.test.tsx`：真实 Expo Router 测试覆盖简化卡片、页面跳转、实时换算、首次录入、非法输入、改回原值、保存后卡片刷新、未保存继续/放弃、网络失败、加载重试及保存中保护。
- `./node_modules/.bin/tsc --noEmit` 与 `./node_modules/.bin/eslint src/features/profile app/_layout.tsx app/cycling-power-zones.tsx`：通过。
- 相关文件的定向 Prettier 检查与 `git diff --check`：通过；页面说明与设计决策已同步至 `RidePilot_UI/design/`。
- `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-ftp-zones-web`：构建成功。
- 全仓 `pnpm typecheck`、`pnpm build` 通过；`pnpm test`：后端 50 项通过，21 项集成测试跳过。`pnpm lint` 未通过，仍阻塞于原有饮食模块 `NutritionProfileSheet.tsx:59`、`NutritionSwapSheet.tsx:35` 的 `react-hooks/set-state-in-effect` 错误，并有教练/饮食模块两个既有 warning；本次涉及文件的定向 ESLint 通过。
- 临时脚本 `node /tmp/ridepilot-ftp-zones-review.mjs` 使用模拟 API 在真实浏览器验证：卡片无测量时间与来源；编辑实时换算、返回确认、保存后概览更新均通过。390×844 和 320×568 下，滚动前后标题与保存按钮坐标不变，标题分别居中于 195/160 px，字号 17 px，保存按钮高 52 px，无横向溢出。截图为 `/tmp/ridepilot-ftp-zones-390.png`、`/tmp/ridepilot-ftp-zones-scrolled.png`、`/tmp/ridepilot-ftp-zones-320-scrolled.png`。
- 真机键盘避让、系统手势返回及大字体外观尚需设备验收；浏览器和组件测试不等同于真机验收。

## FTP 保存时间修复

- API 回归：`apps/api/test/ftp-measurement.e2e-spec.ts`，覆盖省略日期时按服务器时间保存、历史时区时间、未来时间拒绝且无写入、非法日期、鉴权与用户隔离；`plan-input-impact.e2e-spec.ts` 改用省略日期的页面请求，验证更新 FTP 后的未来课程处理。
- App 请求回归：`coach-ftp-api.test.ts` 使用真实 `coachApi`、模拟 fetch 与设备快 8 小时，验证请求不带设备时间、使用服务端返回值，以及响应日期仍必填和错误透传。既有页面测试继续覆盖保存成功、失败保留输入与重试。
- 手动验收：刷新 App，进入“我的 → FTP 功率 → 骑行功率区间”，改为另一有效整数后保存，应显示“FTP 已保存”；完成并返回后瓦数更新，也可继续检查未来训练安排。无需更改手机时间。
- 本次实际执行：`./node_modules/.bin/tsc -p packages/contracts/tsconfig.json`、`./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`、`./node_modules/.bin/tsc -p apps/api/tsconfig.build.json`、`./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src` 均通过；在 `apps/mobile` 执行 `./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint src app` 均通过。
- `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --testTimeout=30000`：33 套件、302 项全量通过。首次定向运行页面套件出现异步 act 冲突，单独重跑 11 项及全量运行均通过；新增真实请求测试 3 项通过。
- 根目录执行 `node /tmp/ridepilot-run-integration.cjs`（检查本机隔离 `*_test` 数据库和 Redis DB 1，执行迁移检查后运行全量 Jest）：40 套件、275 项通过，1 项真实模型测试按配置跳过；FTP 时间回归 9 项、资料变更影响回归 11 项均通过。首次定向执行发现新测试辅助方法参数类型过宽，修正后 API 类型检查和上述全量测试均通过。仅有现有 pg 并发查询弃用提示。
- 本次修改文件的定向 Prettier 检查与 `git diff --check` 通过；无新增数据库迁移，未修改真实用户 FTP 数据。
- 只读检查运行中 API 的 `/api/docs-json`：FTP POST 请求必填为 `valueWatts/source`，响应必填仍含 `measuredAt`，确认开发服务已加载新契约。

2026-11-12：保存位置与文案调整的实际验证见 [移动端个人资料](mobile-profile.md#2026-11-12三个编辑页保存移至标题右侧)。无 API 或数据库变更。
