import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AiException } from "../exceptions/ai.exception";
import { getAiConfig } from "../config/ai.config";
import { AiRequest } from "../interfaces/ai-request.interface";
import {
  AiProvider,
  AiProviderResponse,
} from "../interfaces/ai-provider.interface";

interface OpenAiResponse {
  choices?: Array<{
    message?: { content?: unknown };
    finish_reason?: unknown;
  }>;
  model?: unknown;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
}

@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);

  async generate(request: AiRequest): Promise<AiProviderResponse> {
    const config = getAiConfig();
    if (!config.baseUrl || !config.apiKey || !config.model) {
      throw new AiException(
        "AI_PROVIDER_CONFIG_INVALID",
        "AI provider configuration is incomplete",
        false,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(this.completionsUrl(config.baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model ?? config.model,
          messages: request.messages,
          ...(request.temperature === undefined
            ? {}
            : { temperature: request.temperature }),
          ...(request.maxTokens === undefined
            ? {}
            : { max_tokens: request.maxTokens }),
          ...(request.responseFormat === undefined
            ? {}
            : { response_format: request.responseFormat }),
        }),
        signal: controller.signal,
      });

      const payload = await this.readJson(response);
      if (!response.ok) {
        throw new AiException(
          "AI_PROVIDER_FAILED",
          `AI provider returned HTTP ${response.status}`,
          response.status >= 500 || response.status === 429,
        );
      }

      const parsed = this.parseResponse(payload);
      this.logger.log({
        requestId: request.requestId ?? randomUUID(),
        provider: "openai-compatible",
        model: parsed.model,
        durationMs: Date.now() - startedAt,
        usage: parsed.usage,
      });
      return parsed;
    } catch (error) {
      if (error instanceof AiException) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AiException(
          "AI_PROVIDER_TIMEOUT",
          "AI provider request timed out",
          true,
          { cause: error },
        );
      }
      throw new AiException(
        "AI_PROVIDER_FAILED",
        "AI provider request failed",
        true,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private completionsUrl(baseUrl: string): string {
    const normalized = baseUrl.replace(/\/+$/, "");
    return normalized.endsWith("/chat/completions")
      ? normalized
      : `${normalized}/chat/completions`;
  }

  private async readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      if (!response.ok) return undefined;
      throw new AiException(
        "AI_PROVIDER_INVALID_RESPONSE",
        "AI provider returned invalid JSON",
        false,
        { cause: error },
      );
    }
  }

  private parseResponse(payload: unknown): AiProviderResponse {
    if (!payload || typeof payload !== "object") {
      throw new AiException(
        "AI_PROVIDER_INVALID_RESPONSE",
        "AI provider returned an invalid response",
        false,
      );
    }

    const data = payload as OpenAiResponse;
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (!choice || typeof content !== "string" || content.length === 0) {
      throw new AiException(
        "AI_PROVIDER_INVALID_RESPONSE",
        "AI provider response did not contain text content",
        false,
      );
    }

    const usage = data.usage;
    return {
      text: content,
      model: typeof data.model === "string" ? data.model : "unknown",
      finishReason:
        typeof choice.finish_reason === "string"
          ? choice.finish_reason
          : undefined,
      usage: usage
        ? {
            promptTokens: this.numberOrUndefined(usage.prompt_tokens),
            completionTokens: this.numberOrUndefined(usage.completion_tokens),
            totalTokens: this.numberOrUndefined(usage.total_tokens),
          }
        : undefined,
    };
  }

  private numberOrUndefined(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  }
}
