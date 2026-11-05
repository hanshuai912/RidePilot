export type AiMessageRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiRequest {
  messages: readonly AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Optional provider capability; currently mapped only for native DeepSeek. */
  thinkingMode?: "enabled" | "disabled";
  responseFormat?: { type: "json_object" };
  requestId?: string;
  metadata?: Readonly<Record<string, unknown>>;
}
