import { AiRequest } from "./ai-request.interface";
import { AiResponse } from "./ai-response.interface";

export interface AiProvider {
  generate(request: AiRequest): Promise<AiProviderResponse>;
}

export type AiProviderResponse = Omit<AiResponse, "requestId">;

export const AI_PROVIDER = Symbol("AI_PROVIDER");
