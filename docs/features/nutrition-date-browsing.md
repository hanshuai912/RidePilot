# 饮食计划日期浏览

## 目的与范围

解决饮食 Tab 只能看到今天、无法浏览已生成后续餐食的问题。沿用黑金暗色设计、正式计划与待确认草稿分离，以及独立确认应用流程。包含周浏览、月历跳转、回到今天、最近安排入口和所选日期的生成与编辑；不新增实际进食记录或自动生成任务。

## 用户流程与界面

1. 进入饮食页，按账号时区定位今天。标题下展示周日期条，周一为第一列；金色背景表示所选日期，金点表示该日存在正式餐次，今天有独立边框与无障碍描述。
2. 点击日期查看当天营养目标、三餐与骑行补给；上一周、下一周切换七天。点击年月展开月历，可跨月、跨年选择日期；点击今天恢复当日视图。
3. 今天没有餐次时，查询未来 30 天，若存在正式餐次展示最近安排入口。该范围内为空时明确说明查询范围，更远日期通过月历浏览。
4. 正式餐次优先展示，生成操作放在餐次下方；空日期提供生成入口。按钮明确显示所选日期，生成请求只覆盖该日。
5. 草稿单独展示实际覆盖日期、餐次和校验结果，不计入日历标记。选择其他日期不会改变草稿覆盖范围，只有确认应用才更新正式安排。
6. 编辑份量与时间、替换餐食仍产生草稿；应用后刷新当天详情与日历标记并保留所选日期。训练补给联动按所选日期起七天读取，返回饮食页时保留选择并重新读取。

## 实现与职责

- `components/NutritionDateBrowser.tsx`：周日期条、可展开月历、月份翻页与无障碍状态。
- `components/NutritionUpcomingLink.tsx`：未来 30 天的最近正式安排及独立重试。
- `components/NutritionDailyTarget.tsx`：所选日期的营养目标。
- `hooks/useNutritionOverview.ts`：账号时区、档案、单日详情、页面聚焦与刷新；日期和读取批次共同标识响应。
- `hooks/useNutritionScheduleRange.ts`：正式餐次日期标记、区间请求失效与独立重试。
- `hooks/useNutritionPlan.ts`：保留生成、校验、应用、替换等写入流程；写入期间禁止日期切换。
- `model/nutrition-dates.ts`：与设备时区无关的周/月计算、跨年与闰日处理。

以上路径均位于 `apps/mobile/src/features/nutrition/`。沿用现有请求与 hooks 模式，无新依赖。

## API 与数据

复用既有鉴权、归属校验和 Zod 响应契约：

| 方法 | 接口                                                   | 用途                |
| ---- | ------------------------------------------------------ | ------------------- |
| GET  | `/api/v1/me/profile`                                   | 获取账号时区        |
| GET  | `/api/v1/nutrition/profile`                            | 真实饮食档案        |
| GET  | `/api/v1/nutrition/plan?date=YYYY-MM-DD`               | 单日餐次与该日目标  |
| GET  | `/api/v1/nutrition/plan?from=YYYY-MM-DD&to=YYYY-MM-DD` | 周/月标记与最近安排 |

区间每次不超过 31 天。月历只查询当月，周视图只查询七天，最近安排查询今天之后的 30 天。区间响应仅用于餐次日期，营养目标始终来自单日请求，避免错用计划默认目标。只有 `items[].localDate` 存在才标记安排，不使用全局 `ACTIVE` 状态推断该日有餐次。

无服务端接口、共享契约、数据库或 migration 变更。生成继续使用全局营养版本及 INITIAL/REGENERATE 模式，空日期但已有正式计划时使用 REGENERATE。应用沿用服务端事务、范围合并、幂等和版本冲突检查。

## 错误与并发

- 日期切换后立即隐藏上一次的餐次与目标，未读到该日正式版本前禁用生成与应用。
- 迟到的单日或区间响应不能覆盖当前选择；读取失败不能显示为已确认空日。
- 日期标记加载与失败独立显示，失败仍允许选日查看详情并重试标记；最近安排查询失败有独立重试。
- 当天读取失败展示重试，保留选择；聚焦、刷新、应用后读取均不重置为今天。
- 生成、校验、应用、替换提交期间锁定日期浏览，避免操作上下文改变。

## 测试与验收

- `__tests__/nutrition-date-browsing.test.tsx`：最近日期跳转、回到今天、单日目标、所选日期生成与应用、正式标记刷新、失败重试、迟到响应、账号时区、跨年及闰日。
- `__tests__/nutrition-screen.test.tsx`：保留未建档引导、正式餐食、档案弹窗和草稿明确确认的既有流程。

实际执行（2026-11-16）：

- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --testTimeout=15000`：54 组通过，470 项通过，10 项按既有条件跳过。随后补充生成锁定与两种读取失败用例，执行 `./node_modules/.bin/jest --runInBand src/features/nutrition/__tests__/nutrition-date-browsing.test.tsx --testTimeout=15000`：该文件最终 12 项全部通过。
- 在 `apps/mobile` 执行 `./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/eslint app src`：均通过。
- 在 `apps/mobile` 执行 `CI=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform web --max-workers 2 --output-dir /tmp/ridepilot-nutrition-calendar-web`：通过。
- 执行 `node /tmp/ridepilot-nutrition-calendar-browser.cjs`：使用共享契约校验的合成 API 数据，检查 320、375、390、844 横屏和 1024 像素宽度，完成日期切换、跨月、回到今天和联动页返回流程；21 张截图，未发现横向溢出，无页面错误，也无业务写入。另检查 1.5 倍文字放大模拟与减少动态效果模式。截图与测量位于 `/tmp/ridepilot-nutrition-calendar-evidence/`。
- 本次文件 Prettier 检查与 `git diff --check`：通过。

未执行真机、系统级动态字体/屏幕阅读器和真实大模型验证。本次无服务端业务变更，未重跑数据库集成测试。

## 变更记录

2026-11-16：新增周/月日期浏览及未来安排入口。最近安排快捷查询明确限定未来 30 天，更远安排通过月历浏览。页面保持单日详情，不一次展开全部多日餐食。
