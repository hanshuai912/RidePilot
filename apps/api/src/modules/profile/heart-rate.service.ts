import { ConflictException, Injectable } from "@nestjs/common";
import { HeartRateSave, heartRateResponseSchema } from "@ridepilot/contracts";
import { HeartRateRepository } from "./heart-rate.repository";

@Injectable()
export class HeartRateService {
  constructor(private readonly repository: HeartRateRepository) {}

  async get(userId: string) {
    const row = await this.repository.get(userId);
    return row ? this.toResponse(row) : null;
  }

  async save(userId: string, input: HeartRateSave) {
    const row = await this.repository.save(userId, input);
    if (!row)
      throw new ConflictException({
        code: "HEART_RATE_VERSION_CONFLICT",
        message: "心率设置已在其他页面更新，请重新加载后修改",
      });
    return this.toResponse(row);
  }

  private toResponse(
    row: NonNullable<Awaited<ReturnType<HeartRateRepository["get"]>>>,
  ) {
    return heartRateResponseSchema.parse({
      method: row.method,
      maxHeartRate: row.maxHeartRate,
      restingHeartRate: row.restingHeartRate,
      lactateThresholdHeartRate: row.lactateThresholdHeartRate,
      ruleVersion: row.ruleVersion,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    });
  }
}
