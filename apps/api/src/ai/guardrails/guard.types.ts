import { AiRequest } from "../interfaces/ai-request.interface";
import { AiResponse } from "../interfaces/ai-response.interface";

export type GuardDecision = "ALLOW" | "REJECT" | "REVIEW";

export interface GuardResult {
  decision: GuardDecision;
  reasonCode?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface InputGuardContext {
  request: AiRequest;
}

export interface OutputGuardContext {
  request: AiRequest;
  response: AiResponse;
}
