import { AssessmentsService } from "./assessments.service";
import { AssessmentScheduleService } from "./assessment-schedule.service";
import { AssessmentReviewService } from "./assessment-review.service";
import { AssessmentsController } from "./assessments.controller";
import { RaceImpactService } from "./race-impact.service";
import { RaceTrainingService } from "./race-training.service";
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
import { StagePlansService } from "./stage-plans.service";
import { StagePlansController } from "./stage-plans.controller";
import { CoachGenerationContextService } from "./coach-generation-context.service";
import { TrainingRangeService } from "./training-range.service";
import { CoachCenterController } from "./coach-center.controller";
import { CoachOverviewService } from "./coach-overview.service";
import { CoachSuggestionsService } from "./coach-suggestions.service";
import { CoachSuggestionsRepository } from "./coach-suggestions.repository";

@Module({
  imports: [InfraModule, AiModule],
  controllers: [
    CoachCenterController,
    AssessmentsController,
    StagePlansController,
    CoachDataController,
    CoachChatController,
    CoachEventsController,
    PlanRestoreController,
    AiGenerationController,
    AiProposalController,
  ],
  providers: [
    CoachOverviewService,
    CoachSuggestionsService,
    CoachSuggestionsRepository,
    AssessmentsService,
    AssessmentScheduleService,
    AssessmentReviewService,
    StagePlansService,
    TrainingRangeService,
    CoachGenerationContextService,
    CoachDataService,
    CoachChatService,
    CoachEventsService,
    PlanRestoreService,
    SkillLoaderService,
    CoachPlanValidator,
    CoachProposalService,
    AiGenerationService,
    RaceTrainingService,
    RaceImpactService,
  ],
  exports: [CoachProposalService, PlanRestoreService],
})
export class CoachModule {}
