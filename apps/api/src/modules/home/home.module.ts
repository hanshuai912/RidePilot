import { HomeActionsService } from "./home-actions.service";
import { CoachModule } from "../coach/coach.module";
import { InfraModule } from "../../infra/infra.module";
import { Module } from "@nestjs/common";
import { NutritionModule } from "../nutrition/nutrition.module";
import { ProfileModule } from "../profile/profile.module";
import { TrainingModule } from "../training/training.module";
import { HomeController } from "./home.controller";
import { HomeService } from "./home.service";
@Module({
  imports: [
    ProfileModule,
    TrainingModule,
    NutritionModule,
    CoachModule,
    InfraModule,
  ],
  controllers: [HomeController],
  providers: [HomeService, HomeActionsService],
})
export class HomeModule {}
