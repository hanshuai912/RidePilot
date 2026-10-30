# 移动端 M01 我的与个人资料

## 1. 目的与范围

参考 `RidePilot_UI/design/screens/M01-profile.html` 实现移动端“我的”页面，并接入用户档案与 FTP 测量接口。页面只展示后端已支持的真实账户和运动档案字段，不使用设计稿示例数值。

## 2. 当前实现

- 展示页面昵称、脱敏手机号、手机号验证状态、训练经验和档案版本。
- 新增“心率区间”卡片及独立五/五/七区设置页，三个心率和类型持久化；详见 [统一心率区间](heart-rate-zones.md)。FTP/心率卡片统一为 16 pt 标题、13 pt 数值/操作和 12 pt 辅助说明，沿用黑金卡片规范。
- 编辑并保存昵称、性别、出生日期、身高、体重和训练经验。
- 点击“我的”顶部整张个人卡片，跳转独立的“个人信息”页（`/personal-info`），隐藏底部五栏导航。顶部为左侧返回箭头按钮与居中 17 pt 标题，两侧预留相同宽度以保证标题相对页面居中，图标触控区域为 44 pt。下方“我的资料”分组、“账户与页面昵称”和“身体与能力”入口已移除；FTP 与 COROS 卡片沿用原入口。
- 初次进入或改回原值时“保存资料”禁用；任一可编辑字段发生修改才启用。保存期间禁用表单和返回，防止重复写入及请求中途退出。保存成功返回“我的”，页面重新聚焦后读取最新档案。
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
- 个人信息和骑行功率区间两页共用 `ProfileEditorPage`、`ProfilePageHeader` 及 `useProfileEditorNavigation`：顶部返回图标和 17 pt 居中标题固定，底部保存操作固定，仅中间内容滚动。页脚尊重底部安全区，iOS 键盘弹出时避让键盘；中间内容沿用石墨灰分组和既有主题 token。

## 3. API 契约

| Method     | Path                                  | 权限         | 用途                        |
| ---------- | ------------------------------------- | ------------ | --------------------------- |
| GET        | `/api/v1/me/profile`                  | Access Token | 读取个人资料                |
| POST       | `/api/v1/me/profile`                  | Access Token | 局部保存个人资料和乐观版本  |
| GET / POST | `/api/v1/me/ability-measurements/ftp` | Access Token | 读取最近 FTP / 追加手动测量 |

## 4. 未实现

目标和可训练时间在 AI 教练首次建计划流程填写。完整 FTP 测量历史、饮食偏好、隐私导出/删除、设备同步和设置页仍未作为个人资料页面入口实现。

## 5. 验证

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

- 实现按职责拆为入口 `BirthDateField.tsx`、抽屉 `BirthDateSheet.tsx`、滚轮列 `BirthDateColumn.tsx`、样式 `birth-date-picker.styles.ts`；日期转换、选项和有效性校验位于 `model/birth-date.ts`。
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
