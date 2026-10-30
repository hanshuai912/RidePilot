# 饮食模块服务端基础能力

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

## 尚未接入

- 训练和赛事联动的跨领域一次性原子应用；
- 实际进食记录；
- 训练与营养跨领域的统一原子变更集。

## 移动端接入

- 饮食 Tab 已接入黑金暗色设计体系，首页优先展示当天餐次、训练补给和营养目标。
- 新用户会先填写饮食方式、日常习惯、过敏原和饮食限制；档案保存沿用服务端版本号校验。
- AI 生成使用 `NutritionApi` 和异步生成轮询：生成结果保持为草稿，页面展示摘要、餐次、假设和校验告警，只有用户确认后才调用应用接口。
- 餐次支持提交替换草稿。替换食材默认以 `PARTIAL` 成分状态和低置信度标记，需再次校验后才能应用。
- 网络错误、档案缺失、生成失败、草稿阻塞和版本冲突均保留在页面状态中，不会把失败结果显示成正式计划。
- 主要移动端文件：`apps/mobile/src/features/nutrition/screens/NutritionScreen.tsx`、`services/nutrition.api.ts`、`components/NutritionProfileSheet.tsx`、`components/NutritionProposalCard.tsx`。

## 验证

- `nutrition-validation.spec.ts` 覆盖过敏原、未知成分和估算营养警告。
- 契约和 API TypeScript 类型检查通过。
- 移动端 `nutrition-screen.test.tsx` 覆盖无饮食档案引导和当天餐次展示。
- 移动端类型检查：`./node_modules/.bin/tsc -p apps/mobile/tsconfig.json --noEmit`。
- 移动端定向测试：`apps/mobile/node_modules/.bin/jest --config apps/mobile/jest.config.cjs --runInBand apps/mobile/src/features/nutrition/__tests__/nutrition-screen.test.tsx`。
- AI Provider 测试覆盖响应体超时不能被误判为无效响应：`./node_modules/.bin/jest --runInBand test/ai-provider.spec.ts test/nutrition-generation.spec.ts`（在 `apps/api` 目录执行）。
