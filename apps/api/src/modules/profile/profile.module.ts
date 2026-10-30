import { Module } from "@nestjs/common";
import { InfraModule } from "../../infra/infra.module";
import { ProfileController } from "./profile.controller";
import { ProfileRepository } from "./profile.repository";
import { ProfileService } from "./profile.service";
import { HeartRateController } from "./heart-rate.controller";
import { HeartRateRepository } from "./heart-rate.repository";
import { HeartRateService } from "./heart-rate.service";

@Module({
  imports: [InfraModule],
  controllers: [ProfileController, HeartRateController],
  providers: [
    ProfileRepository,
    ProfileService,
    HeartRateRepository,
    HeartRateService,
  ],
})
export class ProfileModule {}
