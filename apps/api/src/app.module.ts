import { HomeModule } from "./modules/home/home.module";
import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { TrainingModule } from "./modules/training/training.module";
import { CoachModule } from "./modules/coach/coach.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { NutritionModule } from "./modules/nutrition/nutrition.module";

@Module({
  imports: [
    HomeModule,
    AiModule,
    AuthModule,
    HealthModule,
    ProfileModule,
    CoachModule,
    TrainingModule,
    IntegrationsModule,
    NutritionModule,
  ],
})
export class AppModule {}
