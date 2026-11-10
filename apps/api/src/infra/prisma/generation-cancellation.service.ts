import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { generationResponseSchema } from "@ridepilot/contracts";
import { PrismaService } from "./prisma.service";

@Injectable()
export class GenerationCancellationService {
  constructor(private readonly prisma: PrismaService) {}

  cancel(userId: string, id: string, nutritionOnly: boolean) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize cancellation with candidate creation and finalization.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const where = {
        id,
        userId,
        ...(nutritionOnly ? { scene: "NUTRITION_PLAN" } : {}),
      };
      await tx.aiGeneration.updateMany({
        where: { ...where, status: { in: ["QUEUED", "RUNNING"] } },
        data: { status: "CANCELLED", errorCode: null, leaseUntil: null },
      });
      const job = await tx.aiGeneration.findFirst({ where });
      if (!job)
        throw new NotFoundException({
          code: "GENERATION_NOT_FOUND",
          message: "生成任务不存在",
        });
      if (job.status !== "CANCELLED")
        throw new ConflictException({
          code: "GENERATION_NOT_CANCELLABLE",
          message: "任务已结束，无法取消，请查看生成结果",
        });
      return generationResponseSchema.parse({
        generationId: job.id,
        status: job.status,
        proposalId: job.proposalId,
        errorCode: job.errorCode,
        requestId: job.requestId,
      });
    });
  }
}
