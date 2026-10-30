import { Module } from "@nestjs/common";
import { NutritionModule } from "../nutrition/nutrition.module";
import { ProfileModule } from "../profile/profile.module";
import { TrainingModule } from "../training/training.module";
import { HomeController } from "./home.controller";
import { HomeService } from "./home.service";
@Module({
  imports: [ProfileModule, TrainingModule, NutritionModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
