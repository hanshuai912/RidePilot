import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { HealthResponse } from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { RedisService } from "../../infra/redis/redis.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    try {
      const [, redisResult] = await Promise.all([
        this.prisma.$queryRaw`SELECT 1`,
        this.redis.ping(),
      ]);

      if (redisResult !== "PONG") {
        throw new Error("Redis ping failed");
      }

      return { status: "ok", services: { database: "ok", redis: "ok" } };
    } catch {
      throw new ServiceUnavailableException({
        code: "DEPENDENCY_UNAVAILABLE",
        message: "服务暂时不可用",
      });
    }
  }
}
