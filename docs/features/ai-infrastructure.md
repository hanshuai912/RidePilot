# AI 基础设施

本功能为后续 AI 教练、训练计划和营养业务提供统一的 NestJS 内部调用入口。本期只实现基础文本生成，不包含业务 Prompt、训练计划生成、AI Controller 或真实内容审核模型。

## 调用链

业务模块通过依赖注入使用 `AiService.generate()`。调用会依次经过请求校验、InputGuard、Provider、OutputGuard，任一 Guard 拒绝、要求人工审核或发生异常都会停止流程。

```text
AiService
  -> AiOrchestratorService
  -> InputGuard
  -> OpenAI-Compatible Provider
  -> OutputGuard
  -> AiResponse
```

## 配置

在本地环境变量中配置，不要把 API Key 写入代码或提交到 Git：

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=<local-secret>
AI_MODEL=deepseek-flash
AI_TIMEOUT_MS=30000
AI_GUARD_MODE=noop
```

用户提供的 DeepSeek 配置可用于本地手动联调；本仓库不保存该密钥。`AI_BASE_URL` 会在 Provider 内部补上 `/chat/completions`，也可以直接填写完整的兼容端点。

开发和测试环境当前使用 `NoopGuardAdapter`。生产环境禁止使用 NoopGuard；接入真实 Guard 前，生产配置不能启动 AI 模块。

## 业务模块调用

```ts
@Injectable()
export class ExampleService {
  constructor(private readonly ai: AiService) {}

  generateExplanation(): Promise<AiResponse> {
    return this.ai.generate({
      messages: [
        { role: "system", content: "You are a concise assistant." },
        { role: "user", content: "Explain this result." },
      ],
      metadata: { feature: "example" },
    });
  }
}
```

`metadata` 只用于调用追踪和业务侧关联，不会被自动拼接进 Prompt。业务模块不应直接引用 Provider 或任何厂商 SDK。

## 扩展方式

- 新增 OpenAI 不兼容厂商时，实现 `AiProvider` 并替换 `AI_PROVIDER` 的 DI 注册。
- 接入 Qwen3Guard 时，实现 `InputGuard` 或 `OutputGuard` Adapter，并替换对应 DI Token。
- 需要多个审核器时，在 Guard 层组合多个实现；业务模块仍只调用 `AiService`。
- 训练计划等业务能力应在独立业务模块中组装 Prompt、解析结构化结果并执行领域校验，不能下沉到通用 AI 模块。

## 测试

AI 核心测试使用 Mock Provider 和 Mock Guard，不访问真实模型服务。覆盖统一入口、输入/输出拒绝、Guard 异常、`REVIEW` 阻断和请求校验。
