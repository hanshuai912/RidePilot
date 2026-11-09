import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import { env } from "../../config/env";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  });

  constructor() {
    this.client.on("error", (error: NodeJS.ErrnoException) => {
      // Log only the error code: connection messages may contain credentials.
      const code = /^[A-Z0-9_]+$/.test(error.code ?? "")
        ? error.code
        : "CONNECTION_ERROR";
      this.logger.warn(
        `Redis 连接异常（${code}），请检查 Redis 服务及 REDIS_URL。`,
      );
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch {
      this.client.disconnect();
      throw new Error(
        "Redis 连接失败。请在仓库根目录执行 docker compose up -d --wait postgres redis，并检查 apps/api/.env 中的 REDIS_URL 后重启 API。",
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  ping(): Promise<string> {
    return this.client.ping();
  }

  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.eval(
      "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
      1,
      key,
      ttlSeconds,
    );
    return Number(count);
  }
}
