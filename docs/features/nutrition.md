# 饮食与训练补给

## 已完成

- 增加共享 Zod 契约：饮食档案、餐次、营养计划草稿、替换提案和应用响应。
- 增加营养 Prisma 模型及迁移：档案、计划、版本、餐次和提案。
- 增加 `nutrition` NestJS 模块，所有接口通过当前登录用户鉴权和归属查询。
- 支持饮食档案创建、版本化更新和 `OTHER` 限制说明校验。
- 支持按单日或日期范围读取正式营养计划。
- 支持创建完整计划草稿、餐食替换草稿、编辑、重新校验和事务应用。
- 对过敏原冲突、成分未知、版本冲突和幂等应用提供服务端处理。
- 固定并适配 `jelmervdm/skills` 的 `sports-nutrition` Skill；记录上游 commit、许可证和本地适配边界。
- 复用现有 `AiService`、`AiGeneration`、输入/输出 guardrail 和异步任务模式，新增营养生成 worker。
- 增加 `POST /nutrition/plans/generate-proposal` 和 `GET /nutrition/generations/:id`，模型只生成结构化营养提案。
- 增加从 AI 训练提案和赛事生成营养联动草稿的入口，并校验训练计划版本、赛事归属和提案状态。
- 营养生成请求启用 OpenAI 兼容接口的 JSON 响应模式，并在提示词中明确共享 Zod 契约的枚举和嵌套字段，避免模型返回可解析但不可入库的近似结构。
- 赛事补给草稿按日期范围分配输出 token 额度（五天为 20,000，上限 32,000），为多日餐次与模型推理留出空间；禁止模型在严格 `draft` 对象中附加补给策略等契约外字段，策略通过已有餐次与备注表达。
- 营养 worker 只对 `retryable` 模型异常和结构校验失败自动重试；不可重试的无效响应直接返回失败，移动端显示明确错误。

## 尚未接入

- 训练和赛事联动的跨领域一次性原子应用；
- 实际进食记录；
- 训练与营养跨领域的统一原子变更集。

## 移动端接入

- 饮食 Tab 已接入黑金暗色设计体系，首页优先展示当天餐次、训练补给和营养目标。
- 新用户会先填写饮食方式、日常习惯、过敏原和饮食限制；档案保存沿用服务端版本号校验。
- 已有档案的用户通过右上角设置图标打开饮食档案；移除正文中“均衡饮食”等饮食方式摘要卡及重复“编辑”按钮。未建档时仍展示填写引导，编辑抽屉保留饮食方式与限制的选择和保存。
- AI 生成使用 `NutritionApi` 和异步生成轮询：生成结果保持为草稿，页面展示摘要、餐次、假设和校验告警，只有用户确认后才调用应用接口。
- 餐次支持提交替换草稿。替换食材默认以 `PARTIAL` 成分状态和低置信度标记，需再次校验后才能应用。
- 网络错误、档案缺失、生成失败、草稿阻塞和版本冲突均保留在页面状态中，不会把失败结果显示成正式计划。
- 赛事补给入口增加读取资料、排队、生成校验状态和 180 秒整体等待保护。查询超时或网络失败后可重试查询同一任务，避免重复提交积压队列；详见 `docs/features/races.md`。
- 赛事补给按服务端赛事关联恢复已应用方案、有效草稿和进行中任务，重新进入不会默认生成。页面提供显式“重新生成赛事补给”，通过 `forceRegenerate` 请求新候选，确认后才替换正式计划。已应用提案卡片显示“已应用”，隐藏重复应用及校验操作。
- 主要移动端文件：`apps/mobile/src/features/nutrition/screens/NutritionScreen.tsx`、`services/nutrition.api.ts`、`components/NutritionProfileSheet.tsx`、`components/NutritionProposalCard.tsx`。

## 验证

### 2026-11-11：移除重复入口

- 训练日历不再展示补给联动卡片；饮食页保留核对卡片。已有档案时移除“均衡饮食”摘要卡，右上角“编辑饮食档案”继续打开编辑抽屉，关闭后返回当天餐次；新用户填写档案引导保留。
- 在 `apps/mobile` 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/integrations/__tests__/third-party-apps.test.tsx src/features/training/__tests__/training-routes.test.tsx src/features/nutrition/__tests__/training-nutrition.test.tsx`：3 组、60 项通过，覆盖旧入口移除、独立导航及联动草稿失败/恢复/确认流程。
- 执行 `./node_modules/.bin/jest --runInBand --runTestsByPath src/features/nutrition/__tests__/nutrition-screen.test.tsx`：3 项通过，验证正文无饮食摘要与重复编辑按钮、右上角打开/关闭档案、饮食页联动保留、未建档引导和正式计划确认。
- 最后一次页面调整后执行 `./node_modules/.bin/eslint src/features/nutrition/screens/NutritionScreen.tsx src/features/nutrition/__tests__/nutrition-screen.test.tsx`：通过。此前同一任务的 `pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过；`pnpm test` 后端 173 项通过、135 项按已有环境条件跳过。
- 最后一次页面调整后的移动端 `./node_modules/.bin/tsc --noEmit`、本次修改文件 Prettier 检查及 `git diff --check` 均通过。
- 本次无 API、数据库或依赖变更；未做浏览器视觉及真机验收。

### 此前验证

- `nutrition-validation.spec.ts` 覆盖过敏原、未知成分和估算营养警告。
- 契约和 API TypeScript 类型检查通过。
- 移动端 `nutrition-screen.test.tsx` 覆盖无饮食档案引导和当天餐次展示。
- 移动端类型检查：`./node_modules/.bin/tsc -p apps/mobile/tsconfig.json --noEmit`。
- 移动端定向测试：`apps/mobile/node_modules/.bin/jest --config apps/mobile/jest.config.cjs --runInBand apps/mobile/src/features/nutrition/__tests__/nutrition-screen.test.tsx`。
- AI Provider 测试覆盖响应体超时不能被误判为无效响应：`./node_modules/.bin/jest --runInBand test/ai-provider.spec.ts test/nutrition-generation.spec.ts`（在 `apps/api` 目录执行）。
- `pnpm --filter @ridepilot/api test -- --runTestsByPath test/nutrition-generation.spec.ts test/ai-provider.spec.ts`：12 项通过，覆盖五天赛事输出额度、校验后保存草稿、不可重试失败及时结束及临时失败重试。
- 实际模型只读诊断：修复后五天赛事输入返回 15 个餐次并通过共享契约校验；没有将诊断结果保存或应用到正式计划。

## 训练与补给联动、份量与时间编辑

2026-11-11：移除训练日历页的“训练与补给联动”卡片，统一从饮食页面查看该模块。饮食页继续按所选日期核对补给状态、打开联动详情；训练日历不再为该卡片发起状态请求。课程应用结果页的联动提示保留。本次仅调整展示入口，不更改 API、数据库或草稿确认流程。

实现 FR-505 / FR-506：训练应用后可手动生成补给调整草稿，逐日比较旧安排与建议，独立确认后应用。未确认时保留正式饮食。

### 操作路径

1. 饮食页、AI 教练应用成功页、赛事训练应用成功页、单节 AI 调整成功页 →「查看训练补给联动」。
2. 饮食页按今天起 7 天显示核对卡，应用后返回会重新读取状态；训练日历不展示该模块。
3. 联动页选择 1–31 天，点击读取范围；默认只读取/恢复已有任务和草稿，绝不自动生成。超长训练周期分批处理。
4. 缺少饮食档案时在当前页填写偏好、禁忌和用餐时间，保存后仍须点击「生成训练补给草稿」。读取最新正式训练，包含休息日，长骑删除也能调整补给。
5. 预览全部日期的原餐次与建议餐次，包含食物份量、时间、能量、碳水、水分与训练补给备注；可以编辑份量、时间，保存后重新校验。
6. 点击「确认应用到正式计划」后更新范围内饮食，保留范围外餐次。暂不处理可返回，核对提示保留；页面内可显式重新生成。
7. 饮食 → 今日餐次 →「编辑份量和时间」→ 保存为 ITEM_EDIT 草稿 → 校验 → 确认应用。修改份量后原营养值清空，保留食材来源/过敏原信息。

### 技术边界

- 新页面 `/nutrition/training-linked`；读取、生成、编辑和确认由 `useTrainingNutrition` 管理，恢复服务端状态，不用路由携带整份草稿。
- `TrainingNutritionService` 负责待核对日期、任务/草稿恢复与并发去重；`NutritionGenerationContextService` 负责上下文和版本检查；`NutritionApplicationService` 负责事务应用与范围合并。AI 生成 worker 只编排生成与校验。
- 营养与训练分别确认，不自动同步，不实现跨领域原子应用或实际进食日志。
- 网络请求有超时，轮询有 150 秒上限。失败页面保留可操作入口，继续查询恢复服务端任务；重新进入不会新建任务。应用及生成均由服务端再次检查版本。
- 旧营养计划未保存核对记录的日期显示待核对，不把它当成确定的补给不足；不编造精准营养数值。
- 数据沿用 JSON 快照，无 Prisma schema 变更，无需新增数据库迁移。详见 [API](../api/nutrition.md) 和 [数据](../data/nutrition.md)。

### 验证

自动化覆盖手动生成、已有草稿/应用恢复、独立确认、缺资料引导、超时后继续查询、份量与时间校验、按餐次精确编辑、范围外保留、任务并发去重、生成期间训练/营养变化、应用前版本变化、跨用户访问和当前过敏原阻断。

已执行：

- `pnpm --filter @ridepilot/mobile test`：28 个套件、253 个用例通过。
- `pnpm test`：后端 23 个套件、129 个用例通过；未设置 TEST_DATABASE_URL 的数据库套件按设计跳过（10 个套件、60 个用例），另在隔离测试库执行相关集成测试。
- `node /tmp/ridepilot-nutrition-integration.cjs`（工作目录 apps/api）：脚本验证仅使用本机 `*_test` PostgreSQL 和 Redis DB 1，然后运行 `jest --runInBand --runTestsByPath test/training-nutrition.e2e-spec.ts test/nutrition.e2e-spec.ts`，2 个套件、14 个用例通过。模型使用可控测试替身。PostgreSQL 驱动输出已有并发 query 弃用提示，用例全部通过。
- `pnpm typecheck`、`pnpm lint`、`pnpm build` 已执行通过；本次变更文件 Prettier 检查、`git diff --check` 通过。

真实大模型和真机流程尚未验证。生成 worker 保留任务租约、重试和结果写回的同一状态机，生成上下文和正式应用已拆为独立服务。
