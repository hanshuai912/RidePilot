# 移动端 M01 我的与个人资料

## 1. 目的与范围

参考 `RidePilot_UI/design/screens/M01-profile.html` 实现移动端“我的”页面，并接入用户档案与 FTP 测量接口。页面只展示后端已支持的真实账户和运动档案字段，不使用设计稿示例数值。

## 2. 当前实现

- 展示页面昵称、脱敏手机号、手机号验证状态、训练经验和档案版本。
- “FTP 功率 / 心率区间 / 我的赛事 / 目标 / 训练历史 / 第三方 App”按此顺序合为一张石墨灰卡片，“第三方 App”位于列表最后。内部六行列表用细线分隔，各行保留图标、数值或状态和进入箭头。统一为 16 pt 标题、13 pt 数值/操作和 12 pt 辅助说明，分组沿用黑金圆角卡片规范；FTP 和心率仍独立加载与刷新。
- 训练页的“赛事管理 · 备赛与赛后恢复”和“目标与阶段 · 生成课程”移至此列表，入口名为“我的赛事”和“目标”，分别进入现有 `/races`、`/goals`。仅移动导航入口，管理、草稿生成、预览确认与失败重试仍由原页面处理。
- “我的”页面移除“资料变更与未来训练”卡片及“检查未来训练安排”按钮，不再为该卡片读取影响状态；训练页和资料保存后的相关检查入口继续使用现有流程。
- “训练历史”位于“目标”和“第三方 App”之间，进入独立 `/training-history` 页面；列表按日期倒序展示截至今天的课程，整行打开对应历史训练的只读详情。原训练页与 AI 教练的周期复盘入口移除，详见 [训练历史](training-history.md)。
- “心率区间”对应独立五/五/七区设置页，三个心率和类型持久化；详见 [统一心率区间](heart-rate-zones.md)。
- 编辑并保存昵称、性别、出生日期、身高、体重和训练经验。
- 点击“我的”顶部整张个人卡片，跳转独立的“个人信息”页（`/personal-info`），隐藏底部五栏导航。顶部为左侧返回箭头按钮与居中 17 pt 标题，两侧预留相同宽度以保证标题相对页面居中，图标触控区域为 44 pt。下方“我的资料”分组、“账户与页面昵称”和“身体与能力”入口已移除。
- 点击列表内的“第三方 App”跳转独立页面，原 COROS 数据卡片迁移到该页；新页沿用 FTP 页的固定返回标题栏、黑金布局和滚动安全区，授权回调也返回此页。详见 [第三方 App](third-party-apps.md)。
- 初次进入或改回原值时右上角“保存”禁用；任一可编辑字段发生修改才启用。保存期间禁用表单和返回，防止重复写入及请求中途退出。保存成功返回“我的”，页面重新聚焦后读取最新档案。
- 未修改直接返回；有修改未保存时，顶部返回、系统返回及路由移除均弹出“有未保存的修改”，可“继续编辑”保留输入或“放弃修改”返回。确认日期仅修改表单草稿，同样受未保存保护。
- 保存前复用共享 `profilePatchSchema` 验证昵称、身高和体重；数字输入保留原始文本。校验失败、网络失败或版本冲突都在个人信息页显示，保留输入供继续处理。
- 出生日期使用独立 `BirthDateField` 组件：iOS、Android、Web 统一使用黑金底部抽屉，年月日三列上下滚动，停在固定中间选中行的值生效，点击「确认日期」后填入资料草稿。
- 日期可留空、清空，选择范围为 1900 年 1 月 1 日至设备本地今天；切换年月自动修正月末和闰日。取消、遮罩、下拉顶部手柄或系统返回均放弃本次选择，再打开恢复资料草稿中的日期。保存期间禁用日期入口和清空。
- 日期始终按设备本地年月日转换为 `YYYY-MM-DD`，避免 UTC 转换让出生日期偏移一天；资料 API 和数据库结构沿用现有实现。
- 训练时区继续作为训练日期计算的系统上下文返回，但不在个人资料页面展示或编辑；课程显示偏好已从个人资料移除。
- 页面卡片、资料行分隔、间距和暗色信息区按 M01 设计稿对齐；未接入后端的设计稿示例模块不展示。
- 保存通过现有 `POST /api/v1/me/profile` 局部更新接口，提交 `expectedVersion`。
- 后端返回 409 时提示用户重新读取，避免静默覆盖其他设备更新。
- 退出登录沿用现有认证会话流程。
- FTP 功率卡片仅展示标题、当前瓦数（未填写时为“去填写”）和进入箭头，不再展示测量时间和录入方式。点击进入独立“骑行功率区间”页，可编辑 50–800 W 的整数 FTP，下方实时计算 Z1–Z7 的百分比及瓦数。保存后仍追加手动测量记录，返回时刷新概览卡片；详情见 `ftp-power-zones.md`。
- 个人信息、骑行功率区间和心率区间共用 `ProfileEditorPage`、`ProfilePageHeader` 及 `useProfileEditorNavigation`：固定顶部左侧返回图标、17 pt 居中标题及右侧金色文字“保存”，按钮触控区域至少 44×44 pt，移除底部保存栏，只有中间内容滚动。保留底部安全区和 iOS 键盘避让，中间内容沿用石墨灰分组和既有主题 token。数据未加载或初次读取失败时隐藏保存，其他禁用条件与保存流程不变。

## 3. API 契约

| Method     | Path                                  | 权限         | 用途                        |
| ---------- | ------------------------------------- | ------------ | --------------------------- |
| GET        | `/api/v1/me/profile`                  | Access Token | 读取个人资料                |
| POST       | `/api/v1/me/profile`                  | Access Token | 局部保存个人资料和乐观版本  |
| GET / POST | `/api/v1/me/ability-measurements/ftp` | Access Token | 读取最近 FTP / 追加手动测量 |

## 4. 未实现

目标和可训练时间在 AI 教练首次建计划流程填写。完整 FTP 测量历史、饮食偏好、隐私导出/删除、设备同步和设置页仍未作为个人资料页面入口实现。

## 5. 验证

### 2026-11-12：三个编辑页保存移至标题右侧

- 个人信息、骑行功率区间和心率区间的保存统一移到固定标题栏右侧，只显示「保存」，移除底部保存栏。保留标题居中、44×44 pt 点击区域、保存中加载／禁用、无效与未修改禁用、错误重试和未保存返回确认。
- 修正窄操作区被按钮默认水平内边距挤压导致「保存」换成两行的问题：标题栏使用无内边距的固定宽触控区，文字明确单行显示，左右操作区仍等宽。
- `ProfileEditorPage` 提供共享保存操作，`ProfilePageHeader` 透传右侧内容；三个页面沿用原 editor hooks 和请求。第三方 App 页共用容器但没有保存操作，保持原行为。无 API、数据库或依赖变化。
- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/profile/__tests__/ftp-power-zones.test.tsx src/features/profile/__tests__/heart-rate-zones.test.tsx src/features/profile/__tests__/profile-screen.test.tsx src/features/integrations/__tests__/third-party-apps.test.tsx`：4 组、40 项通过。包括标题栏内唯一保存入口、滚动内容无保存按钮，以及原有保存／校验／失败／并发／返回保护。
- `./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint src/features/profile`：通过。
- `./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-profile-header-save-web --max-workers 2`：成功。
- `node /tmp/ridepilot-profile-header-save-browser.cjs`：三个页面在 320／390／430 宽度确认「保存」横向单行、点击区域至少 44×44 pt、位于居中标题右侧、滚动后固定；有修改才启用，无横向溢出、脚本错误或业务写请求。截图 `/tmp/ridepilot-header-save-{cycling-power-zones,heart-rate-zones,personal-info}-{320,390,430}.png`。
- 修改文件 Prettier、主仓库及设计仓库 `git diff --check` 通过；同步 M01 交接说明与设计决策。未执行原生真机、软键盘或系统大字体验证。

### 2026-11-11：训练历史入口

- 六行设置列表按“FTP 功率、心率区间、我的赛事、目标、训练历史、第三方 App”排列；训练历史跳转独立受保护页面，原周期复盘入口移除。
- 移动端相关 5 组、80 项测试、移动端类型检查、改动文件 ESLint 及 Web 导出通过，命令与接口验证详见 [训练历史](training-history.md#验证)。

### 2026-11-11：移除资料变更入口

- 移除 `ProfileScreen` 中的 `PlanImpactEntryCard`，档案卡片、五行设置列表和个人资料编辑流程继续展示。
- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/profile/__tests__/profile-screen.test.tsx src/features/integrations/__tests__/third-party-apps.test.tsx`：2 组、18 项通过。新增断言验证“我的”页面不显示该卡片标题和检查按钮；原个人资料编辑、保存、失败处理和设置列表导航测试通过。
- `./node_modules/.bin/tsc --noEmit`、相关文件 ESLint、Prettier 检查及 `git diff --check` 均通过。本次仅移除页面入口，无 API、数据库或依赖变更，未执行真机验收。

### 2026-11-11：赛事与目标入口迁移

- 后续排序调整：“第三方 App”移至“目标”下方，作为列表最后一行。重新执行移动端 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/integrations/__tests__/third-party-apps.test.tsx`，7 项通过；`./node_modules/.bin/tsc --noEmit`、相关文件 ESLint、Prettier 和 `git diff --check` 均通过。
- `ProfilePlanningEntries.tsx` 复用 FTP 行的 `profileMetricStyles`：金色图标、72 pt 最小行高、16 pt 标题、右侧箭头和对齐标题的分隔线；接入现有 `ProfileSettingsList`，没有新增请求或状态。
- `third-party-apps.test.tsx` 验证五行顺序、独立路由跳转和返回“我的”；`training-routes.test.tsx` 验证训练页保留日历与周期复盘，不再出现赛事、目标及补给联动入口。
- `pnpm --filter @ridepilot/mobile test -- --runTestsByPath src/features/integrations/__tests__/third-party-apps.test.tsx src/features/training/__tests__/training-routes.test.tsx src/features/profile/__tests__/profile-screen.test.tsx`：3 组、63 项通过。
- 移除训练补给卡片后，在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/integrations/__tests__/third-party-apps.test.tsx src/features/training/__tests__/training-routes.test.tsx src/features/nutrition/__tests__/training-nutrition.test.tsx`：3 组、60 项通过，包含联动草稿恢复、生成失败与确认应用。
- `pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过；`pnpm test`：后端 31 组、173 项通过，16 组、135 项按既有环境条件跳过。修改文件 Prettier 检查与 `git diff --check` 通过。
- 本次无 API、契约、数据库或依赖变更；未做浏览器视觉或真机验收。

### 此前个人资料迭代验证

- 本轮三行列表与第三方 App 迁移：`ProfileSettingsList.tsx` 统一外框，三个入口保留独立加载、状态和导航；完整验证见 [第三方 App](third-party-apps.md)。移动端 Jest 19 套件、143 项通过，类型检查、定向 ESLint 和 Web 导出通过。浏览器模拟 API 在 390/320 宽验证分组无额外内边距、行间无卡片间距、独立跳转及返回、无横向溢出；全量源码 lint 仍有饮食模块两处既有错误。
- 移动端 TypeScript 类型检查通过。
- 个人资料、首页和首次建计划相关移动端测试通过。
- 个人资料页面 ESLint 和相关文件 Prettier 检查通过。

### 个人信息入口与未保存保护

- 路由壳：`apps/mobile/app/personal-info.tsx`，在根受保护 Stack 下注册；展示层：`screens/PersonalInformationScreen.tsx` 与 `components/PersonalInformationForm.tsx`；加载、校验、保存：`hooks/usePersonalInformation.ts`；草稿转换与差异判断：`model/profile-draft.ts`。
- 复用黑金 `Dialog`，增加可配置关闭按钮文案（默认仍为“关闭”），本页使用“继续编辑”。通过 Expo Router 的 `usePreventRemove` 拦截离开动作，确认放弃时继续原动作；保存成功清除脏状态后返回。直接打开该页面而没有历史记录时，返回“我的”。
- 已执行移动端 `./node_modules/.bin/jest --runInBand`：15 个套件、94 项测试通过。个人资料路由测试覆盖卡片跳转、旧入口移除、六项字段、无修改/还原禁用、保存返回并刷新、顶部与路由返回确认、继续编辑/放弃、保存中保护、失败/冲突保留草稿、加载重试及非法输入。
- 已执行移动端 `./node_modules/.bin/tsc --noEmit`，以及 `./node_modules/.bin/eslint src/features/profile src/components/ui/Dialog.tsx app/personal-info.tsx app/_layout.tsx`：通过。
- 顶部图标和标题调整后重新执行 `./node_modules/.bin/jest --runInBand src/features/profile/__tests__`：3 个套件、28 项通过；再次执行移动端类型检查、定向 ESLint、相关文件 Prettier 检查及 `git diff --check`，均通过。
- 已执行 `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-personal-info-web`：构建成功。临时 CDP 脚本 `node /tmp/ridepilot-personal-info-review.mjs` 使用模拟 API 验证真实浏览器中的卡片跳转、旧入口移除、保存启用及还原、返回确认、继续编辑保留草稿、放弃后恢复原值；320 px 页面无横向溢出。
- 最终浏览器验证：390 px 屏宽下标题计算字号为 17 px、中心坐标为 195 px，返回按钮为 44×44 px；等待动画结束后核对未保存弹窗的暗色面板与遮罩。截图位于 `/tmp/ridepilot-personal-info-390.png`、`/tmp/ridepilot-personal-info-unsaved.png` 和 `/tmp/ridepilot-personal-info-320.png`。
- 全仓 `pnpm typecheck`、`pnpm build` 通过；`pnpm test`：后端 50 项通过、21 项跳过。本轮 `pnpm lint` 未通过，仍为饮食模块 `NutritionProfileSheet.tsx:59`、`NutritionSwapSheet.tsx:35` 的既有错误和两个既有 warning；本轮涉及文件定向检查通过。
- 本轮未改 API、共享契约、数据库或原生依赖；已有开发包刷新 Metro 即可。尚未在真机执行手势返回与系统返回验收。

### 出生日期选择组件

- 实现按职责拆为入口 `BirthDateField.tsx`、抽屉 `BirthDateSheet.tsx`；滚轮列与黑金样式提取为 `components/ui/DateWheelColumn.tsx`、`components/ui/date-picker.styles.ts`，供训练规划日期复用。出生日期的转换、选项和有效性校验仍位于 `model/birth-date.ts`，范围和保存行为不变。
- 复用 App 的石墨灰面板、香槟金中间选中带和确认按钮、主题 token 与安全区。行高不小于 44 pt，随字体缩放增长；小屏减少可见行数，首尾补足空间，让第一项和最后一项也能居中。
- 年份列表自 1900 年起，范围有限，使用固定行高的 `ScrollView` 保持行位置稳定。快速滑动中只记录偏移，不逐帧更新日期或重新定位；惯性停止后再取中间值，仅在静止后补齐非整行偏移。拖动未产生惯性以及 Web 滚动使用停止后的延时兜底。任一列滚动期间暂时禁用确认，防止提交旧值。
- 日期抽屉不再调用系统日期控件，不增加原生依赖；现有 `@react-native-community/datetimepicker` 依赖暂保留。已有开发包连接 Metro 后刷新即可加载本轮 JS 改动，无需重新打包。
- `birth-date-field.test.tsx` 覆盖三平台一致交互、确认/取消/清空、保存禁用、三列滚动、首尾范围、闰日联动，以及快速滑动期间预览不跳变、确认禁用、停止后只提交一次。`birth-date.test.ts` 验证本地日期转换和范围；`profile-screen.test.tsx` 验证日期随资料和 `expectedVersion` 提交。
- 本轮在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand`：15 个套件、86 项测试通过，包含惯性持续超过兜底时间时不提前选中，以及无惯性拖动结束后的选中与解禁确认。
- 本轮执行 `./node_modules/.bin/tsc --noEmit` 和 `./node_modules/.bin/eslint src/features/profile src/theme/colors.ts`：均通过。
- 本轮执行 `CI=1 ./node_modules/.bin/expo export --platform web --output-dir /tmp/ridepilot-birth-date-drawer-web`：Web 构建成功。
- 本轮执行临时 CDP 验证脚本 `node /tmp/ridepilot-date-drawer-review.mjs`（使用模拟 API）：390×844 和 320×568 下无横向溢出，52 px 确认按钮位于可见区域，确认填入草稿及取消关闭通过。连续滚动年份时预览保持稳定，停止后选中 2002 年，选中行与窗口中线偏差为 0 px。截图位于 `/tmp/ridepilot-date-drawer-390.png` 和 `/tmp/ridepilot-date-drawer-320.png`。
- 本轮相关代码和文档的定向 Prettier 检查及 `git diff --check` 通过。
- 先前原生日期控件版本已执行全仓类型检查、构建和后端测试；后端 50 项测试通过、21 项集成测试跳过。本轮仅调整日期 UI，不更改 API、契约和数据库。
- 先前全仓 `pnpm lint` 未通过，阻塞为原有 `NutritionProfileSheet.tsx:59` 和 `NutritionSwapSheet.tsx:35` 的 `react-hooks/set-state-in-effect` 错误，并存在教练/饮食页面的既有 warning；本轮未修改这些组件，未声称全仓 lint 通过。
- 真机仍需验证快速连续滑动与中途反向拖动的流畅度。自动化交互测试不等同于真机帧率验收。

## 6. Android 开发包

此前系统日期控件版本需要补入 `com/reactcommunity/rndatetimepicker` 原生模块，已按用户要求构建并交付以下开发包。当前自定义抽屉及快速滚动修复均为 JS/TypeScript 改动，继续使用该包并刷新 Metro 即可。

沿用当前生成的 Android 工程、`com.ridepilot.dev` 包名和 debug 签名，使用已安装的 Temurin JDK 17，在 `apps/mobile/android` 执行：

```bash
JAVA_HOME=/home/XiaoH/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2 ./gradlew :app:assembleDebug --build-cache --max-workers=4 -PreactNativeDevServerPort=8081
```

原始产物路径：`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`，交付时复制到仓库根目录 `RidePilot-dev.apk`，并将此生成文件加入 Git 忽略规则。这是连接 Metro 的 debug 开发包；安装后仍需启动 `pnpm --filter @ridepilot/mobile start`，并确保手机能连接开发机的 Metro 与 API。通过 USB 调试时可使用 `adb install -r RidePilot-dev.apk` 覆盖安装，并执行 `adb reverse tcp:8081 tcp:8081`；API 的 USB 转发与环境变量配置见 README。

本次构建与产物验证：

- 上述 Gradle 命令返回 `BUILD SUCCESSFUL`，397 个任务中 109 个执行、3 个来自缓存、285 个已是最新状态。
- `apksigner verify --verbose` 通过 APK v2 签名验证；`aapt dump badging` 确认包名为 `com.ridepilot.dev`、版本为 `0.1.0`、可调试，最低 Android API 为 24。
- Python ZIP 完整性检查通过，DEX 包含 `RNDateTimePickerPackage`；包含 `arm64-v8a`、`armeabi-v7a`、`x86`、`x86_64` 四种架构。
- 根目录 APK 大小为 244,987,315 字节，复制后与原始产物 SHA-256 一致：`f10223f3a3486acf7ea8d894533e7db053b4184d4bddc019aa565645e1a4d820`。
- 本次按要求交付安装文件，尚未在手机上安装或验证系统日期控件交互。

## 2026-11-13：能力与训练管理分组

能力设置与训练管理/历史分组，个人资料失败可重试；FTP/心率修改后的区间标为未保存预览。完整范围、验证命令与验收边界见 [全局页面结构优化](global-ui-ux-structure.md)。
