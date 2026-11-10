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
import { resolveStageReview } from "./goals/stage-review.repository";
import { assertStageReviewScope } from "./goals/stage-review.scope";
import { readPlanningGoals, planningGoalsMatch } from "./goals/planning-goals";

@Injectable()
export class TrainingRangeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    userId: string,
    input: RangeGeneration,
  ): Promise<WeekGenerationInput> {
    if (input.stageReviewId) {
      const review = await resolveStageReview(
        this.prisma,
        userId,
        input.stageReviewId,
      );
      assertStageReviewScope(review, {
        goalId: input.goalId,
        ...(input.scope === "STAGE"
          ? { stageId: input.stageId }
          : { weekStartDate: input.startDate, endDate: input.endDate }),
      });
    }
    if (!!input.assessmentId !== !!input.assessmentVersion)
      throw new BadRequestException({
        code: "ASSESSMENT_VERSION_REQUIRED",
        message: "复评课程需要测试及版本",
      });
    if (input.assessmentId) {
      const assessment = await this.prisma.trainingAssessment.findFirst({
        where: { id: input.assessmentId, userId },
      });
      if (!assessment)
        throw new NotFoundException({
          code: "ASSESSMENT_NOT_FOUND",
          message: "测试不存在",
        });
      if (assessment.version !== input.assessmentVersion)
        throw new ConflictException({
          code: "ASSESSMENT_VERSION_CONFLICT",
          message: "测试已变化，请重新复评",
        });
      if (
        ![
          "COMPLETED",
          "INCOMPLETE",
          "SKIPPED",
          "INVALID",
          "POSTPONED",
        ].includes(assessment.status)
      )
        throw new ConflictException({
          code: "ASSESSMENT_NOT_REVIEWABLE",
          message: "请先录入结果或说明测试状态",
        });
    }
    let startDate: string;
    let endDate: string;
    if (input.scope === "STAGE") {
      const stage = await this.prisma.trainingStage.findFirst({
        where: {
          id: input.stageId,
          stagePlan: { userId },
        },
        include: { stagePlan: { include: { goal: true } } },
      });
      if (!stage)
        throw new NotFoundException({
          code: "STAGE_NOT_FOUND",
          message: "阶段不存在",
        });
      if (
        !planningGoalsMatch(
          stage.stagePlan.goalsSnapshot,
          await readPlanningGoals(this.prisma, userId),
        ) ||
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
      if (input.stageReviewId) {
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: user.timezone,
        }).format(new Date());
        if (startDate < today) startDate = today;
      }
    } else {
      startDate = input.startDate;
      endDate = input.endDate;
    }
    assertDateRange(startDate, endDate, 84);
    return {
      ...(input.stageReviewId ? { stageReviewId: input.stageReviewId } : {}),
      ...(input.forceRegenerate ? { forceRegenerate: true } : {}),
      goalId: input.goalId,
      weekStartDate: startDate,
      endDate,
      mode: "range",
      expectedBaseVersion: input.expectedBaseVersion,
      ...(input.scope === "STAGE" ? { stageId: input.stageId } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.assessmentId
        ? {
            relatedId: input.assessmentId,
            relatedVersion: input.assessmentVersion,
            reason: "ASSESSMENT" as const,
          }
        : {}),
    };
  }
}
