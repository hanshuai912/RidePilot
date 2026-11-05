import { NutritionApplicationService } from "./nutrition-application.service";
import { NutritionGenerationContextService } from "./nutrition-generation-context.service";
import { Module } from "@nestjs/common";
import { AiModule } from "../../ai/ai.module";
import { InfraModule } from "../../infra/infra.module";
import { NutritionPlanController } from "./nutrition-plan.controller";
import { NutritionPlanService } from "./nutrition-plan.service";
import { NutritionProfileController } from "./nutrition-profile.controller";
import { NutritionProfileService } from "./nutrition-profile.service";
import { NutritionProposalController } from "./nutrition-proposal.controller";
import { NutritionProposalService } from "./nutrition-proposal.service";
import { NutritionRepository } from "./nutrition.repository";
import { NutritionGenerationController } from "./nutrition-generation.controller";
import { NutritionGenerationService } from "./nutrition-generation.service";
import { NutritionSkillLoaderService } from "./nutrition-skill-loader.service";
import { RaceNutritionService } from "./race-nutrition.service";

import { TrainingNutritionService } from "./training-nutrition.service";

@Module({
  imports: [InfraModule, AiModule],
  controllers: [
    NutritionProfileController,
    NutritionPlanController,
    NutritionProposalController,
    NutritionGenerationController,
  ],
  providers: [
    NutritionApplicationService,
    NutritionGenerationContextService,
    NutritionRepository,
    NutritionProfileService,
    NutritionPlanService,
    NutritionProposalService,
    NutritionGenerationService,
    NutritionSkillLoaderService,
    RaceNutritionService,
    TrainingNutritionService,
  ],
  exports: [NutritionProposalService, NutritionPlanService],
})
export class NutritionModule {}
