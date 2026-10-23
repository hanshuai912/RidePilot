import { Module } from "@nestjs/common";
import { env } from "../config/env";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { AiService } from "./ai.service";
import { AI_INPUT_GUARD, AI_OUTPUT_GUARD } from "./guardrails/guard.interface";
import { NoopGuardAdapter } from "./guardrails/noop-guard.adapter";
import { AI_PROVIDER } from "./interfaces/ai-provider.interface";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible.provider";

function guardFactory(noop: NoopGuardAdapter): NoopGuardAdapter {
  if (env.NODE_ENV === "production") {
    throw new Error("NoopGuard cannot be used in production");
  }
  return noop;
}

@Module({
  providers: [
    AiService,
    AiOrchestratorService,
    OpenAiCompatibleProvider,
    NoopGuardAdapter,
    { provide: AI_PROVIDER, useExisting: OpenAiCompatibleProvider },
    {
      provide: AI_INPUT_GUARD,
      useFactory: guardFactory,
      inject: [NoopGuardAdapter],
    },
    {
      provide: AI_OUTPUT_GUARD,
      useFactory: guardFactory,
      inject: [NoopGuardAdapter],
    },
  ],
  exports: [AiService],
})
export class AiModule {}
