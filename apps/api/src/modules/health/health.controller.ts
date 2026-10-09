import { Controller, Get } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  type SchemaObject,
} from "@nestjs/swagger";
import { healthResponseSchema, HealthResponse } from "@ridepilot/contracts";
import { z } from "zod";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: "检查数据库和 Redis 的就绪状态" })
  @ApiOkResponse({
    description: "PostgreSQL 和 Redis 均可用",
    // Zod's generic JSON Schema type allows arrays in `type`; this schema targets OpenAPI 3.0.
    schema: z.toJSONSchema(healthResponseSchema, {
      target: "openapi-3.0",
    }) as unknown as SchemaObject,
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
