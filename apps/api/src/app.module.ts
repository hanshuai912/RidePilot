import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { TrainingModule } from "./modules/training/training.module";

@Module({ imports: [AuthModule, HealthModule, ProfileModule, TrainingModule] })
export class AppModule {}
