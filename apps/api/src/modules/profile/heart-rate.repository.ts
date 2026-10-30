import { Injectable } from "@nestjs/common";
import { HeartRateSave } from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class HeartRateRepository {
  constructor(private readonly prisma: PrismaService) {}

  get(userId: string) {
    return this.prisma.heartRateSettings.findUnique({ where: { userId } });
  }

  save(userId: string, input: HeartRateSave) {
    return this.prisma.$transaction(async (tx) => {
      // Serializes first creation as well as updates for this authenticated user.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const current = await tx.heartRateSettings.findUnique({
        where: { userId },
      });
      const { expectedVersion, ...data } = input;
      const same =
        current &&
        current.method === data.method &&
        current.maxHeartRate === data.maxHeartRate &&
        current.restingHeartRate === data.restingHeartRate &&
        current.lactateThresholdHeartRate === data.lactateThresholdHeartRate;
      // Identical PUT retries are idempotent for the immediately preceding version.
      if (
        same &&
        (current.version === expectedVersion ||
          current.version === expectedVersion + 1)
      )
        return current;
      if ((current?.version ?? 0) !== expectedVersion) return null;
      return current
        ? tx.heartRateSettings.update({
            where: { userId },
            data: { ...data, version: { increment: 1 } },
          })
        : tx.heartRateSettings.create({ data: { userId, ...data } });
    });
  }
}
