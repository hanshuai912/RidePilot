import { TrainingCalendarService } from "./training-calendar.service";
import { TrainingHistoryRepository } from "./training-history.repository";
import { TrainingHistoryService } from "./training-history.service";
import { WorkoutRescheduleService } from "./workout-reschedule.service";
import { Module } from "@nestjs/common";
import { InfraModule } from "../../infra/infra.module";
import { TrainingOverviewService } from "./training-overview.service";
import { TrainingController } from "./training.controller";
import { TrainingRepository } from "./training.repository";
import { TrainingService } from "./training.service";
import { TrainingApplicationService } from "./training-application.service";
import { CoachModule } from "../coach/coach.module";

@Module({
  imports: [InfraModule, CoachModule],
  controllers: [TrainingController],
  providers: [
    TrainingRepository,
    TrainingCalendarService,
    TrainingHistoryRepository,
    TrainingHistoryService,
    WorkoutRescheduleService,
    TrainingService,
    TrainingApplicationService,
    TrainingOverviewService,
  ],
  exports: [TrainingOverviewService],
})
export class TrainingModule {}
