import { Module } from "@nestjs/common";
import { AiModule } from "../../ai/ai.module";
import { InfraModule } from "../../infra/infra.module";
import { AiGenerationController } from "./ai-generation.controller";
import { AiGenerationService } from "./ai-generation.service";
import { AiProposalController } from "./ai-proposal.controller";
import { CoachDataController } from "./coach-data.controller";
import { CoachDataService } from "./coach-data.service";
import { CoachChatController } from "./coach-chat.controller";
import { CoachChatService } from "./coach-chat.service";
import { CoachEventsController } from "./coach-events.controller";
import { CoachEventsService } from "./coach-events.service";
import { CoachPlanValidator } from "./coach-plan.validator";
import { CoachProposalService } from "./coach-proposal.service";
import { SkillLoaderService } from "./skill-loader.service";
import { PlanRestoreController } from "./plan-restore.controller";
import { PlanRestoreService } from "./plan-restore.service";

@Module({
  imports: [InfraModule, AiModule],
  controllers: [
    CoachDataController,
    CoachChatController,
    CoachEventsController,
    PlanRestoreController,
    AiGenerationController,
    AiProposalController,
  ],
  providers: [
    CoachDataService,
    CoachChatService,
    CoachEventsService,
    PlanRestoreService,
    SkillLoaderService,
    CoachPlanValidator,
    CoachProposalService,
    AiGenerationService,
  ],
  exports: [CoachProposalService, PlanRestoreService],
})
export class CoachModule {}
