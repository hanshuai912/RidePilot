# Repository Development Rules

本仓库的开发规范详见 **[`agents/development/Agent.md`](./agents/development/Agent.md)**。在开始任何实现任务前先阅读并遵循它。

必须执行的要点：

1. React Native + Expo + TypeScript 与 NestJS + TypeScript 位于同一个 pnpm Monorepo；PostgreSQL + Prisma；共享 Zod API 契约。
2. 按业务领域和职责拆分组件、hooks、services、controllers、repositories，禁止把完整业务堆到一个文件。
3. 前端只调用 API，不直连数据库或大模型私钥；AI 计划先作为草稿，验证、预览并获用户确认后再应用。
4. 对用户相关 API 做鉴权和归属校验；关键写操作保证事务、幂等及版本冲突检查。
5. 每完成一个功能，**同一个开发任务内更新 `docs/features/<feature-name>.md`**；接口、数据库、技术选型变更还要同步更新对应文档。
6. 必须实现并验证相关测试和错误状态，报告实际执行的命令与结果；未验证不能宣称通过。
7. 视觉遵循 `agents/design/Agent.md`，产品逻辑遵循 `PRD.md` 和产品 Agent；当前 V1 仅支持黑金暗色设计体系。

如果这些文件尚未创建，先按具体任务构建所需目录，不要因模板直接创建大量空文件。
