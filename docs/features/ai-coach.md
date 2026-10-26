# AI 骑行教练 API

本阶段实现非饮食训练闭环的后端：FTP、目标和可训练时间准备，生成周计划草稿，用户预览、修改和确认后发布；已发布课程可因时间、疲劳、错过训练、测试结果或赛事变化提出调整草稿。聊天只解释当前计划，不直接写入训练数据。移动端尚未接入这些新接口。

## 调用链

1. 客户端保存 FTP、训练目标、可训练日与时长；`GET /ai-coach/readiness` 返回缺失项。AI 训练入口要求已有有效 FTP。
2. 客户端提交带幂等键的生成请求。API 校验身份、资源归属、基础版本和可编辑范围，持久化 `AiGeneration` 并返回任务 ID。
3. 后台 worker 读取当前用户的目标、FTP、可用时间、正式课程及相关测试/赛事，通过 `SkillLoaderService` 加载固定名单内的训练 Skill，再经 `AiService` 的 Guard → Provider → Guard 链调用模型。
4. 模型只返回 JSON 草稿。共享 Zod 契约与 `CoachPlanValidator` 校验结构、日期、时长、强度和恢复约束。无效输出最多重新生成一次；仍失败则任务标记 `FAILED`。通过后创建 `ChangeProposal`，不改变正式版本。
5. 客户端轮询任务，读取提案，必要时修改并重新校验。应用时在数据库事务中锁定用户，重新检查计划版本、目标、FTP、可训练时间、事件版本和训练记录，再创建新的不可变计划版本。日历仅展示最新正式版本。
6. 历史版本恢复也先生成提案，只复制未来且未记录训练的课程。确认应用后创建新版本，保留旧版本。

## Skill 与职责

`apps/api/skills/cycling-training/SKILL.md` 是 RidePilot 运行适配层，训练知识基于三个固定版本的 MIT 开源 Skill：`jelmervdm/skills` 的骑行区间与赛事规则、`estruyf/skill-cycling-plan-coach` 的周计划和课程库、`mprecilio20/adaptive-endurance-coach` 的恢复、测试和赛事方法。完整来源、提交号、原文及许可证见 `apps/api/skills/cycling-training/UPSTREAM.md`。加载器固定读取基础规则、功率区间和一个场景引用，并将来源清单纳入内容哈希；原始上游文件不会被注入模型，也不会执行上游的 MCP、文件写入或饮食指令。Skill 只影响模型建议；日期、权限、功率与计划写入由服务端代码决定。

`CoachDataService` 管基础资料；`CoachEventsService` 管训练记录、测试和赛事；`AiGenerationService` 管任务和 Prompt 上下文；`CoachPlanValidator` 管模型输出；`CoachProposalService` 管 AI 草稿与发布；`PlanRestoreService` 管历史恢复；`CoachChatService` 管只读解释。共享请求和响应类型在 `packages/contracts/src/coach.ts`。

## 安全与当前范围

- 所有业务路由需要 JWT；查询和变更按 `userId` 限定。已记录训练及历史日期不能被覆盖。明显不适标记阻断训练计划生成。
- FTP 在 AI 训练入口必填。人工课程仍沿用原有规则，可在没有 FTP 时使用绝对功率。此处按本次确认的需求实现，与产品 PRD 中“FTP 可选”的旧表述不同，正式产品文档需要同步。
- FTP 目标可结构化填写 `targetWkg`。目标功率由服务端用当前体重换算；例如 55 kg、4 W/kg 对应 220 W。当前 FTP 为 193 W 时，当前功体比约 3.51 W/kg。若填写功体比目标但未录入体重，资料检查返回 `weightKg` 缺失。身高和体重只从当前用户运动档案读取；档案版本变化会使未应用的 AI 提案失效。
- AI 生成的 `stageSummary` 和 `assessmentSuggestion` 是提案说明文本；本阶段尚未建立独立阶段表或自动定时复评任务。
- 本地开发环境的 AI Guard 仍是 Noop；生产环境配置会拒绝用 Noop 启动。接入真实审核适配器前，不能把这套 AI 接口声明为生产可用。真实模型联调也仅验证开发环境链路。
- 目前只实现 API 和数据层；移动端教练界面及其调用尚未接入。饮食和外部骑行平台自动同步不在本阶段。

## 验证

`pnpm --filter @ridepilot/api test:integration` 在隔离的本地 `ridepilot_test` 数据库上应用迁移并运行 Jest/Supertest。覆盖缺失 FTP、异步生成、重复请求、归属校验、预览确认、工作课调整、测试/赛事触发、历史恢复、已记录训练保护及源标记。真实模型联调的实际结果另行记录，不把 Mock 测试当成模型质量验收。

Skill 加载测试检查固定来源、场景选择和上游工具指令隔离；功体比用例检查缺体重阻断及 4 W/kg 对应 220 W 的确定性换算。

需要真实模型联调时，先在 `apps/api/.env` 配置 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`，并在 `apps/api/.env.test` 配置隔离测试库，然后运行 `RUN_LIVE_AI=1 pnpm --filter @ridepilot/api test:integration`。门控用例创建临时用户，生成并读取一份草稿，不应用正式计划；会产生一次或有限重试的模型调用费用。

2026-10-26 实际联调：真实 `deepseek-flash` 调用返回有效 JSON，任务状态 `READY`，提案未应用。以身高 170 cm、体重 55 kg、FTP 193 W、长期目标 4 W/kg（220 W）、初学者及周二/四/六可训练为输入，生成 2026-11-02 至 11-08 的三节课程：周二 45 分钟有氧、周四 50 分钟有氧耐力、周六 50 分钟温和节奏（2×10 分钟 80%–85% FTP）。模型建议先建立规律训练和恢复，本周不安排 FTP 复测。记录的请求 ID：`7e9c85fd-6200-43fe-a108-7c9626da007c`。
