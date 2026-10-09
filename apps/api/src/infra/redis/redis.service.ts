import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { env } from "../../config/env";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });

  async onModuleInit(): Promise<void> {
    await this.client.connect();
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
