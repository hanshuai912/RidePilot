import { Injectable } from "@nestjs/common";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { AiRequest } from "./interfaces/ai-request.interface";
import { AiResponse } from "./interfaces/ai-response.interface";

@Injectable()
export class AiService {
  constructor(private readonly orchestrator: AiOrchestratorService) {}

  generate(request: AiRequest): Promise<AiResponse> {
    return this.orchestrator.generate(request);
  }
}
