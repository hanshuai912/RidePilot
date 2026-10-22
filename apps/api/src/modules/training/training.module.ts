import { Module } from "@nestjs/common";
import { InfraModule } from "../../infra/infra.module";
import { TrainingController } from "./training.controller";
import { TrainingRepository } from "./training.repository";
import { TrainingService } from "./training.service";
import { TrainingApplicationService } from "./training-application.service";

@Module({
  imports: [InfraModule],
  controllers: [TrainingController],
  providers: [TrainingRepository, TrainingService, TrainingApplicationService],
})
export class TrainingModule {}
