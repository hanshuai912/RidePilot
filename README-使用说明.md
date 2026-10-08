# 开发 Agent 使用说明

这是可直接放进你的 Git Monorepo 根目录的 Agent 文件包。

- `AGENTS.md`：放在仓库根目录，供支持该约定的代码 Agent 自动读取。
- `agents/development/Agent.md`：完整版开发规则，开发时应完整阅读。

**建议目录**

```text
repo/
├── AGENTS.md
├── PRD.md
├── agents/
│   ├── development/Agent.md
│   ├── product/agent.md
│   └── design/Agent.md
├── apps/
│   ├── mobile/
│   └── api/
├── packages/contracts/
└── docs/features/
```

请不要把产品 Agent 或 UI 设计 Agent 的文件内容覆盖进开发 Agent；它们关注不同问题，开发任务可按需一并读取。

**首次可用指令：**

> 先阅读根目录 AGENTS.md、agents/development/Agent.md 和 PRD.md。检查目前仓库结构，给出最小可执行 Monorepo 初始化方案及分阶段任务清单。未经确认不要引入额外技术栈；开始实现后每个功能同步补充 docs/features 文档，并运行相应检查。
