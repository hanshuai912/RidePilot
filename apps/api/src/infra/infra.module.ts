import { GenerationCancellationService } from "./prisma/generation-cancellation.service";
import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { RedisService } from "./redis/redis.service";

@Module({
  providers: [PrismaService, RedisService, GenerationCancellationService],
  exports: [PrismaService, RedisService, GenerationCancellationService],
})
export class InfraModule {}
