# 统一心率区间

## 范围与入口

“我的”在 FTP 功率卡片之后增加“心率区间”，点击进入 `/heart-rate-zones`。每个账号只有一套统一设置，不按运动类型拆分，页面统一称“乳酸阈心率”。本功能只保存设置和计算区间，不改写历史记录或自动重排训练计划。

## 页面与交互

- 共用 `ProfileEditorPage`：左侧返回图标、17 pt 居中标题固定，底部 52 pt 保存按钮固定，只有中间表单与区间列表滚动；使用现有黑金 tokens、安全区与键盘避让。
- 顶部三个单选项为最大心率区间（5 区）、储备心率区间（5 区）、乳酸阈心率区间（7 区）。切换类型保留全部已填数值，保存请求也包含非当前类型的数值。
- 最大心率类型填写最大心率；储备心率类型填写最大心率及静息心率；乳酸阈类型填写乳酸阈心率。初次读取为空时显示空表单及 `— bpm`，不自动估算或填入示例心率。
- 有效输入立即计算；未修改、还原原值、缺少当前类型必填字段或输入非法时禁用保存。非法的隐藏字段保留明确错误提示，切换回对应类型可修正。
- 顶部及系统返回在有修改时弹出继续编辑/放弃修改；保存期间禁止修改、重复提交与离开。保存失败保留草稿；409 提示返回后重新进入读取，避免覆盖最新设置。
- 返回“我的”时重新读取数据库设置。卡片显示当前类型及区间数，不展示示例心率、测量时间或录入方式。
- FTP 与心率入口共用 `profile-metric-card.styles.ts`：16 pt / 500 标题、13 pt 数值或操作文案、12 pt 心率类型说明，32 pt 图标容器、18 pt 线性图标、16 pt 内边距、18 pt 圆角及至少 72 pt 行高。支持文字缩放，保持可点击区域与小屏排版。

## V1 计算规则

计算函数与 Zod 契约位于 `packages/contracts/src/heart-rate.ts`，规则版本 `1`。这些是本产品的默认分区，不声明为唯一行业标准，比例在每行公开显示。

| 类型            | 区间比例                                                      | 换算                                    |
| --------------- | ------------------------------------------------------------- | --------------------------------------- |
| 最大心率 5 区   | 50–<60%、60–<70%、70–<80%、80–<90%、90–100%                   | 最大心率 × 比例                         |
| 储备心率 5 区   | 同上                                                          | 静息心率 +（最大心率 − 静息心率）× 比例 |
| 乳酸阈心率 7 区 | <85%、85–<90%、90–<95%、95–<100%、100–<103%、103–<107%、≥107% | 乳酸阈心率 × 比例                       |

以整数 bpm 展示，下一分区起点向上取整，上一分区终点为该起点减一，避免重叠、间隙及浮点边界漂移。最大/储备心率类型最后一区止于最大心率，低于第一分区起点不计入训练区间。阈值类型第一分区显示 `≤`、末分区显示 `≥`；不使用最大心率截断阈值区间。

例如最大 200、静息 60、阈值 180：最大法为 100–119 / 120–139 / 140–159 / 160–179 / 180–200；储备法为 130–143 / 144–157 / 158–171 / 172–185 / 186–200；阈值法为 ≤152 / 153–161 / 162–170 / 171–179 / 180–185 / 186–192 / ≥193 bpm。

软件录入范围：最大及阈值心率 80–250、静息心率 20–120 bpm，均为整数。这些是产品校验范围，不是健康判断；静息心率必须低于已填最大心率，储备法两者至少相差 10 bpm，确保五个分区均存在整数心率。

参考：[TrainingPeaks 的方法分类](https://help.trainingpeaks.com/hc/en-us/articles/360017420092-Zones-Calculator-Overview)、[Joe Friel 的七区比例示例](https://www.trainingpeaks.com/learn/articles/joe-friel-s-quick-guide-to-setting-zones/)。阈值七区采用后者 85/90/95/100/103/107 的分界，作为统一产品默认值；未加入其运动分类。储备法采用静息心率加心率储备比例，5 区比例由本产品固定为 50–100%。

## API 与数据

详见 [API](../api/heart-rate.md) 与 [数据说明](../data/heart-rate.md)。新增 `heart_rate_settings` 一对一表，持久化当前类型、三个心率、计算规则版本、并发版本及 UTC 时间。鉴权沿用全局守卫，用户归属只来自令牌；不接受客户端用户 ID。

保存在事务内锁定当前用户行，包含首次创建的竞争也会串行执行。版本不匹配返回 409；对当前版本或紧邻前一版本的相同内容 PUT 返回当前设置，避免网络重试产生重复更新。更旧版本仍返回冲突。更新成功才递增版本。

迁移 `20261030110000_heart_rate_settings` 只新增表，不删除或重写现有用户、FTP 和训练数据。生产环境不在本任务迁移范围内。本次不新增原生依赖，已有开发包连接 Metro 后刷新即可。

## 实现与测试

- 移动端：`components/HeartRateSettingsCard.tsx`、`HeartRateForm.tsx`、`HeartRateZones.tsx`，`hooks/useHeartRateEditor.ts`，`model/heart-rate-draft.ts`，`services/heart-rate.api.ts`，`screens/HeartRateZonesScreen.tsx`。
- API：profile 模块内独立 `heart-rate.controller/service/repository.ts`。
- `apps/api/test/heart-rate.spec.ts`：三种计算、整数连续边界、必填及非法输入、所有权字段拒绝。
- `apps/api/test/heart-rate.e2e-spec.ts`：真实 PostgreSQL 存取、401、账号隔离、方法切换保留输入、并发首次保存、幂等重试、并发更新、409、数据库约束。
- `apps/mobile/src/features/profile/__tests__/heart-rate-zones.test.tsx`：真实 Router 页面切换、初次空状态、实时五/七区、草稿保留、保存回写刷新、非法输入、返回确认、失败重试及保存中保护。

实际执行与结果：

- `./node_modules/.bin/prisma generate`、`prisma validate`：成功。
- `./node_modules/.bin/prisma migrate deploy` 与 `prisma migrate status`：本地开发库 `ridepilot` 已应用新增迁移，状态为最新；本机 `ridepilot_test` 也成功应用。未操作生产数据库。
- 使用临时脚本 `node /tmp/ridepilot-heart-rate-integration.cjs`，执行与 `test/run-integration.cjs` 相同的本机测试库/Redis DB 1 限制，以已安装的 Prisma/Jest 二进制替代卡住的 pnpm 启动器。真实数据库心率测试 5 项和计算/契约测试 14 项均通过。
- 上述全量后端测试：88 通过、1 跳过、1 失败。失败为未修改的 `test/training.e2e-spec.ts:189`，课程详情响应缺少日历响应中存在的 `editable` 字段，故不能宣称全量后端测试通过。
- 移动端 `./node_modules/.bin/jest --runInBand`：18 套件、136 项通过；最后的卡片字号调整后再运行个人资料全部测试：6 套件、70 项通过；显式字体变体修正后再运行 FTP/心率交互测试：2 套件、22 项通过。
- contracts 的 `tsc -p tsconfig.json`、API 的 `tsc -p tsconfig.build.json` / `tsc -p tsconfig.json --noEmit`、mobile 的 `tsc --noEmit` 均通过。后端/契约 `oxlint`、移动端 profile 与相关路由定向 ESLint、修改文件 Prettier 和 `git diff --check` 通过。
- 移动端全量源代码 `eslint src app` 仍存在饮食模块 `NutritionProfileSheet.tsx:59`、`NutritionSwapSheet.tsx:35` 两个既有 `set-state-in-effect` 错误，以及教练/饮食两个 warning。`eslint .` 还会扫描已有 dist 导出文件，不适合作为源码质量统计；未更改这些生成文件或忽略规则。
- `./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-heart-rate-web` 成功。模拟 API 的 CDP 浏览器验证脚本 `node /tmp/ridepilot-heart-rate-review.mjs` 在 390×844 与 320×568 验证三种类型、实时计算、未保存确认、保存回卡片刷新、标题及底部保存固定、无横向溢出。标题中心分别为 195 / 160 px；小屏保存按钮位于 y=504–556，可见且不随内容滚动。
- 追加浏览器计算样式检查确认卡片标题实际为 16 px、数值/操作 13 px、辅助说明 12 px；使用 AppText 的明确变体与 className 避免默认正文样式覆盖字号。截图位于 `/tmp/ridepilot-heart-rate-cards-390.png`、`/tmp/ridepilot-heart-rate-threshold-320.png`、`/tmp/ridepilot-heart-rate-threshold-320-scrolled.png` 等临时文件。
- 设计说明同步到 `RidePilot_UI/design/screens/M01-profile.md` 与 `RidePilot_UI/design/decisions.md`。本轮为 JS/API 改动，无需重新生成开发 APK；真机手势、键盘和帧率仍未做实际设备验收。

本地开发服务曾加载残留的 `apps/api/dist/src/main.js`，其优先级高于当前构建输出 `dist/main.js`。已将旧生成目录备份为 `apps/api/dist/legacy-src-heart-rate`，按原命令和环境重载 Nest 开发监听器。没有修改源码启动配置或用户凭据；日志位于 `/tmp/ridepilot-api-heart-rate.log`。
