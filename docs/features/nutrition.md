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

## 尚未接入

- 训练和赛事联动的跨领域一次性原子应用；
- 实际进食记录；
- 训练与营养跨领域的统一原子变更集。

## 验证

- `nutrition-validation.spec.ts` 覆盖过敏原、未知成分和估算营养警告。
- 契约和 API TypeScript 类型检查通过。
