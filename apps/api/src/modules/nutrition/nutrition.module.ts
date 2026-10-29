import { Module } from "@nestjs/common";
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

@Module({
  imports: [InfraModule],
  controllers: [
    NutritionProfileController,
    NutritionPlanController,
    NutritionProposalController,
    NutritionGenerationController,
  ],
  providers: [
    NutritionRepository,
    NutritionProfileService,
    NutritionPlanService,
    NutritionProposalService,
    NutritionGenerationService,
    NutritionSkillLoaderService,
  ],
  exports: [NutritionProposalService],
})
export class NutritionModule {}
