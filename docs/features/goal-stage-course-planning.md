# 目标阶段与按范围生成课程

## 范围与流程

2026-10-30 用户确认：FTP 必填；具体课程可按阶段或起止日期生成。训练页和 AI 教练提供“目标与阶段”入口，进入目标列表、目标详情。阶段生成独立于课程生成，不自动发布训练，也不自动安排测试。

1. 无 FTP：直接进入骑行功率区间设置，保存后返回原页面，保留日期、阶段选择、备注及手动课程草稿。
2. 阶段：选择起止日期，生成结构化阶段草稿 → 独立预览页 → 确认阶段安排。旧阶段仅在确认事务成功后归档。
3. 课程：选择当前阶段或输入日期范围 → 生成草稿 → 预览拟替换课程与新课程 → 校验 → 明确确认 → 原子应用 → 训练日历读取新版本。

## 规则

- FTP 门槛覆盖 AI 周计划、范围生成、调整和手动课程创建、编辑、校验及应用；绝对功率 W 也不能绕过。历史查看和实际训练反馈仍可使用。
- 单次课程生成 1–84 天；阶段安排最多 365 天、12 个连续阶段，每阶段最多 84 天。这是本次实现对输出长度的限制，不是用户已确认的训练周期政策；界面明确说明。较长周期分阶段生成课程。
- 日期范围无需周一开始。阶段日期由服务端从当前用户的已确认阶段解析；不接受客户端覆盖阶段日期。已过去日期不生成新课程。
- 只替换范围内当天及未来、没有实际记录的课程；已记录和范围外课程连同稳定记录关联一并保留。返回影响日期包含删除课程日期。
- 模型输出必须覆盖每个存在可训练日期的自然周，避免多周请求只得到首周课程。不可训练日、赛事/已安排测试、每日及单次时长和现有安全功率/恢复规则继续校验。
- 阶段确认及课程应用检查目标、FTP、可训练时间、运动档案和当前阶段/正式计划版本；发生变更需重新生成。阶段重新确认不会隐式覆盖既有课程。
- 生成复用现有异步任务、Skill 和服务端模型适配器；前端不持有模型密钥。模型失败不修改正式计划。
- 骑行适配规则升级至 1.2.0，阶段和多周范围使用独立场景引用，避免套用单周七天限制；选中阶段的训练目的和复评方向进入课程生成上下文。

## 实现

- 契约：`packages/contracts/src/stages.ts`、`coach.ts`。
- 后端：`stage-plans.service.ts`、`stage-plan.validation.ts`、`training-range.service.ts`；周/范围公共上下文拆为 `coach-generation-context.service.ts`，避免继续扩大任务 Worker。
- 课程应用复用 `CoachProposalService` 的版本化事务、用户锁和幂等入口。该服务继续集中保留既有发布事务和校验流程；没有复制第二套发布逻辑。
- 移动端：`features/goals` 分离 screens、components、hooks、services，路由 `/goals`、`/goals/[goalId]`、`/goals/stage-preview`、`/goals/course-preview`。
- UI：现有黑金 Tokens、`NavigationHeader`、`TrainingPage`、`PlanPreview`；短标题、固定顶部、独立预览路由。

## 状态与失败恢复

首次读取有 loading、错误重试及目标空状态；旧数据刷新失败展示错误。未确认草稿不影响正式安排。生成失败保留条件；不确定网络结果保留请求与幂等键；轮询超时可继续查询原任务。确认应用响应丢失时直接使用相同提案、基准版本和幂等键重试，不先编辑或重验已应用草稿。确认阶段响应丢失时同一草稿和原 expectedVersion 可重试。提交中禁止重复操作和返回；备注有未保存离开确认。

## API、数据与迁移

见 [AI 教练 API](../api/ai-coach.md) 和 [AI 教练数据](../data/ai-coach.md)。新增迁移 `20261030160000_training_stages`，只新增阶段表和索引，无既有数据回填。阶段测试录入与复评的移动端完整流程仍为后续任务，本功能的复评内容仅为建议说明。

## 验证

自动化覆盖：无 FTP 拦截、阶段连续性和完整性、任意跨周范围、草稿不自动发布、用户归属、阶段确认幂等、FTP 更新阻断旧阶段、阶段替换阻断旧课程草稿、已记录与范围外课程保护、影响日期及课程发布幂等；移动端覆盖 FTP 路由、返回保留条件、阶段/日期请求、确认失败保留和应用超时重试。

测试文件：`apps/api/test/goal-planning.e2e-spec.ts`、`stage-plan.spec.ts`、`training.validation.e2e-spec.ts`；`apps/mobile/src/features/goals/__tests__/goal-planning.test.tsx`，并回归既有训练和 AI 教练用例。AI 集成测试使用模型替身；不代表真实模型生成质量或真机验收。

2026-10-30 实际执行：

- `pnpm --filter @ridepilot/api test:integration`：最终 23 套件、110 项通过；1 个真实模型测试按开关跳过。隔离测试库迁移成功。
- 移动端 `./node_modules/.bin/jest --runInBand`：22 套件、192 项通过。随后新增两个手动 FTP 返回用例，并重跑受影响的训练路由套件，37 项全部通过；目标规划套件最终 6 项通过，包含带输入条件的预览确认应用。
- `pnpm build`：contracts 与 API 构建通过。API `./node_modules/.bin/tsc -p tsconfig.json --noEmit`、移动端 `./node_modules/.bin/tsc --noEmit` 通过。
- 移动端 `./node_modules/.bin/eslint src app`、根目录 `./node_modules/.bin/oxlint apps/api/src apps/api/test packages/contracts/src`、本次修改文件 Prettier 检查及 `git diff --check` 通过。
- API `./node_modules/.bin/prisma validate`、`prisma generate` 通过；`pnpm --filter @ridepilot/api db:deploy` 已将新增表迁移应用到本机非生产开发库。
- 移动端 `./node_modules/.bin/expo export --platform android --output-dir /tmp/ridepilot-goal-range-android` 通过。

未执行实体设备操作验收与真实模型调用；较长课程范围的真实生成耗时和输出质量需要后续联调。测试运行有现有 pg 并行查询弃用提示，不影响本轮通过结果。
