export interface AiTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiResponse {
  requestId: string;
  text: string;
  model: string;
  usage?: AiTokenUsage;
  finishReason?: string;
  metadata?: Readonly<Record<string, unknown>>;
}
