export type AiErrorCode =
  | "AI_INVALID_REQUEST"
  | "AI_PROVIDER_CONFIG_INVALID"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_FAILED"
  | "AI_PROVIDER_INVALID_RESPONSE"
  | "AI_INPUT_REJECTED"
  | "AI_OUTPUT_REJECTED"
  | "AI_GUARD_REVIEW_REQUIRED"
  | "AI_GUARD_FAILED"
  | "AI_UNSUPPORTED_CAPABILITY";

export class AiException extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiException";
  }
}
