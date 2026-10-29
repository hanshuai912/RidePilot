import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { TrainingModule } from "./modules/training/training.module";
import { CoachModule } from "./modules/coach/coach.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";

@Module({
  imports: [
    AiModule,
    AuthModule,
    HealthModule,
    ProfileModule,
    CoachModule,
    TrainingModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
