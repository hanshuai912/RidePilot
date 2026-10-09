import { Module } from "@nestjs/common";
import { InfraModule } from "../../infra/infra.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  imports: [InfraModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
