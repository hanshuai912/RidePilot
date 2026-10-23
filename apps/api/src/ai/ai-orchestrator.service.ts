import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AiException } from "./exceptions/ai.exception";
import {
  AI_INPUT_GUARD,
  AI_OUTPUT_GUARD,
  InputGuard,
  OutputGuard,
} from "./guardrails/guard.interface";
import { GuardResult } from "./guardrails/guard.types";
import { AI_PROVIDER, AiProvider } from "./interfaces/ai-provider.interface";
import { AiRequest } from "./interfaces/ai-request.interface";
import { AiResponse } from "./interfaces/ai-response.interface";

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @Inject(AI_INPUT_GUARD) private readonly inputGuard: InputGuard,
    @Inject(AI_OUTPUT_GUARD) private readonly outputGuard: OutputGuard,
  ) {}

  async generate(request: AiRequest): Promise<AiResponse> {
    const normalized = this.validateRequest(request);
    const requestId = normalized.requestId ?? randomUUID();
    const startedAt = Date.now();

    try {
      const inputResult = await this.runGuard("input", () =>
        this.inputGuard.check({ request: { ...normalized, requestId } }),
      );
      this.assertAllowed(inputResult, "input");

      const providerResponse = await this.provider.generate({
        ...normalized,
        requestId,
      });
      const response: AiResponse = { ...providerResponse, requestId };

      const outputResult = await this.runGuard("output", () =>
        this.outputGuard.check({
          request: { ...normalized, requestId },
          response,
        }),
      );
      this.assertAllowed(outputResult, "output");

      this.logger.log({
        requestId,
        model: response.model,
        durationMs: Date.now() - startedAt,
        inputGuard: inputResult.decision,
        outputGuard: outputResult.decision,
        usage: response.usage,
      });
      return response;
    } catch (error) {
      this.logger.warn({
        requestId,
        stage: this.stageFor(error),
        errorCode: error instanceof AiException ? error.code : "UNKNOWN",
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  private validateRequest(request: AiRequest): AiRequest {
    if (
      !request ||
      !Array.isArray(request.messages) ||
      request.messages.length === 0 ||
      request.messages.some(
        (message) =>
          !message ||
          !["system", "user", "assistant"].includes(message.role) ||
          typeof message.content !== "string" ||
          message.content.trim().length === 0,
      )
    ) {
      throw new AiException(
        "AI_INVALID_REQUEST",
        "AI request must contain at least one valid message",
        false,
      );
    }

    if (
      request.temperature !== undefined &&
      (!Number.isFinite(request.temperature) || request.temperature < 0)
    ) {
      throw new AiException(
        "AI_INVALID_REQUEST",
        "AI temperature must be a non-negative finite number",
        false,
      );
    }

    if (
      request.maxTokens !== undefined &&
      (!Number.isInteger(request.maxTokens) || request.maxTokens <= 0)
    ) {
      throw new AiException(
        "AI_INVALID_REQUEST",
        "AI maxTokens must be a positive integer",
        false,
      );
    }

    if (request.model !== undefined && request.model.trim().length === 0) {
      throw new AiException(
        "AI_INVALID_REQUEST",
        "AI model cannot be empty",
        false,
      );
    }
    return request;
  }

  private async runGuard(
    stage: "input" | "output",
    check: () => Promise<GuardResult>,
  ): Promise<GuardResult> {
    try {
      const result = await check();
      if (!result || !["ALLOW", "REJECT", "REVIEW"].includes(result.decision)) {
        throw new Error("Guard returned an invalid decision");
      }
      return result;
    } catch (error) {
      if (error instanceof AiException) throw error;
      throw new AiException("AI_GUARD_FAILED", `${stage} guard failed`, true, {
        cause: error,
      });
    }
  }

  private assertAllowed(result: GuardResult, stage: "input" | "output"): void {
    if (result.decision === "ALLOW") return;
    if (result.decision === "REVIEW") {
      throw new AiException(
        "AI_GUARD_REVIEW_REQUIRED",
        `${stage} guard requires review`,
        false,
        { cause: result.reasonCode },
      );
    }
    throw new AiException(
      stage === "input" ? "AI_INPUT_REJECTED" : "AI_OUTPUT_REJECTED",
      `${stage} guard rejected the request`,
      false,
      { cause: result.reasonCode },
    );
  }

  private stageFor(error: unknown): string {
    if (!(error instanceof AiException)) return "orchestrator";
    if (error.code.startsWith("AI_INPUT")) return "input_guard";
    if (error.code.startsWith("AI_OUTPUT")) return "output_guard";
    if (error.code.startsWith("AI_GUARD")) return "guard";
    if (error.code.startsWith("AI_PROVIDER")) return "provider";
    return "request";
  }
}
