import { Controller, Get } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { healthResponseSchema, HealthResponse } from "@ridepilot/contracts";
import { Public } from "../../common/public.decorator";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "检查数据库和 Redis 的就绪状态" })
  @ApiOkResponse({
    description: "PostgreSQL 和 Redis 均可用",
    schema: toOpenApiSchema(healthResponseSchema),
  })
  @ApiServiceUnavailableResponse({
    description: "PostgreSQL 或 Redis 不可用",
    schema: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string", example: "DEPENDENCY_UNAVAILABLE" },
        message: { type: "string", example: "服务暂时不可用" },
      },
    },
  })
  async getHealth(): Promise<HealthResponse> {
    return healthResponseSchema.parse(await this.health.check());
  }
}
