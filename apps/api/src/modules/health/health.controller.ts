import { Controller, Get } from "@nestjs/common";
import { healthResponseSchema, HealthResponse } from "@ridepilot/contracts";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    return healthResponseSchema.parse(await this.health.check());
  }
}
