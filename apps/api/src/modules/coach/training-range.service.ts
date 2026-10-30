import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type RangeGeneration,
  type WeekGenerationInput,
} from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dbToDate } from "../training/training.validation";
import { assertDateRange } from "./stage-plan.validation";

@Injectable()
export class TrainingRangeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    userId: string,
    input: RangeGeneration,
  ): Promise<WeekGenerationInput> {
    let startDate: string;
    let endDate: string;
    if (input.scope === "STAGE") {
      const stage = await this.prisma.trainingStage.findFirst({
        where: {
          id: input.stageId,
          stagePlan: { userId, goalId: input.goalId },
        },
        include: { stagePlan: { include: { goal: true } } },
      });
      if (!stage)
        throw new NotFoundException({
          code: "STAGE_NOT_FOUND",
          message: "阶段不存在",
        });
      if (
        stage.stagePlan.status !== "ACTIVE" ||
        stage.stagePlan.goal.status !== "ACTIVE" ||
        stage.stagePlan.goalVersion !== stage.stagePlan.goal.version
      )
        throw new ConflictException({
          code: "STAGE_PLAN_STALE",
          message: "阶段已变更，请重新选择或生成阶段安排",
        });
      const [ftp, availability, user] = await Promise.all([
        this.prisma.abilityMeasurement.findFirst({
          where: { userId, metricType: "FTP", unit: "W" },
          orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
        }),
        this.prisma.trainingAvailability.findUnique({ where: { userId } }),
        this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      ]);
      if (!ftp || Number(ftp.value) <= 0)
        throw new BadRequestException({
          code: "FTP_REQUIRED",
          message: "请先设置 FTP，再生成课程",
        });
      if (
        ftp?.id !== stage.stagePlan.ftpMeasurementId ||
        availability?.version !== stage.stagePlan.availabilityVersion ||
        user.profileVersion !== stage.stagePlan.profileVersion
      )
        throw new ConflictException({
          code: "STAGE_PLAN_STALE",
          message: "训练资料已变化，请重新生成阶段安排",
        });
      startDate = dbToDate(stage.startDate);
      endDate = dbToDate(stage.endDate);
    } else {
      startDate = input.startDate;
      endDate = input.endDate;
    }
    assertDateRange(startDate, endDate, 84);
    return {
      goalId: input.goalId,
      weekStartDate: startDate,
      endDate,
      mode: "range",
      expectedBaseVersion: input.expectedBaseVersion,
      ...(input.scope === "STAGE" ? { stageId: input.stageId } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    };
  }
}
