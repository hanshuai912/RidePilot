import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { env } from "../../config/env";
import { RedisService } from "../../infra/redis/redis.service";

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly redis: RedisService) {}

  async check(
    action: "register" | "login" | "refresh",
    identifier: string,
    ip: string,
  ): Promise<void> {
    const windowSeconds = action === "register" ? 3600 : 900;
    const identifierLimit =
      action === "register" ? 5 : action === "login" ? 10 : 30;
    const ipLimit = action === "register" ? 20 : action === "login" ? 50 : 100;
    const hash = (value: string) =>
      createHmac("sha256", env.JWT_ACCESS_SECRET).update(value).digest("hex");

    let identifierHits: number;
    let ipHits: number;
    try {
      [identifierHits, ipHits] = await Promise.all([
        this.redis.incrementWithExpiry(
          `auth:${action}:id:${hash(identifier)}`,
          windowSeconds,
        ),
        this.redis.incrementWithExpiry(
          `auth:${action}:ip:${hash(ip)}`,
          windowSeconds,
        ),
      ]);
    } catch {
      throw new ServiceUnavailableException({
        code: "AUTH_RATE_LIMIT_UNAVAILABLE",
        message: "认证服务暂不可用",
      });
    }

    if (identifierHits > identifierLimit || ipHits > ipLimit) {
      throw new HttpException(
        { code: "AUTH_RATE_LIMITED", message: "请求过于频繁，请稍后重试" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
