import { Module } from "@nestjs/common";
import { InfraModule } from "../../infra/infra.module";
import { ProfileController } from "./profile.controller";
import { ProfileRepository } from "./profile.repository";
import { ProfileService } from "./profile.service";

@Module({
  imports: [InfraModule],
  controllers: [ProfileController],
  providers: [ProfileRepository, ProfileService],
})
export class ProfileModule {}
