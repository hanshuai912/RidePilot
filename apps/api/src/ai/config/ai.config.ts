import { env } from "../../config/env";

export interface AiConfig {
  provider: "openai-compatible";
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs: number;
  guardMode: "noop";
}

export function getAiConfig(): AiConfig {
  return {
    provider: env.AI_PROVIDER,
    baseUrl: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
    guardMode: env.AI_GUARD_MODE,
  };
}

export function assertAiConfigForUse(config: AiConfig): void {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error("AI provider configuration is incomplete");
  }
}
