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
  requestId?: string;
  metadata?: Readonly<Record<string, unknown>>;
}
