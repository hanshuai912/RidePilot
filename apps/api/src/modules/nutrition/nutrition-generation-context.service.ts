import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { NutritionGenerationInput } from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dbToDate, dateToDb } from "../training/training.validation";
import { trainingDateSignatures } from "./training-nutrition-context";

@Injectable()
export class NutritionGenerationContextService {
  constructor(private readonly prisma: PrismaService) {}
  async read(
    userId: string,
    input: NutritionGenerationInput,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (input.startDate > input.endDate)
      throw new BadRequestException({
        code: "NUTRITION_DATE_INVALID",
        message: "计划开始日期不能晚于结束日期",
      });
    const days =
      (dateToDb(input.endDate).getTime() -
        dateToDb(input.startDate).getTime()) /
        86_400_000 +
      1;
    if (days > 31)
      throw new BadRequestException({
        code: "NUTRITION_DATE_RANGE_TOO_LARGE",
        message: "一次最多生成 31 天饮食草稿",
      });
    const [
      nutritionProfile,
      athleteProfile,
      user,
      plan,
      nutritionPlan,
      workouts,
      race,
      trainingProposal,
    ] = await Promise.all([
      db.nutritionProfile.findUnique({ where: { userId } }),
      db.athleteProfile.findUnique({ where: { userId } }),
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true, locale: true, profileVersion: true },
      }),
      db.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: true },
      }),
      db.nutritionPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { activeVersion: { include: { items: true } } },
      }),
      db.workout.findMany({
        where: {
          planVersion: { activeForPlan: { userId, status: "ACTIVE" } },
          scheduledDate: {
            gte: dateToDb(input.startDate),
            lte: dateToDb(input.endDate),
          },
        },
        orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
      }),
      input.raceId
        ? db.trainingRace.findFirst({
            where: { id: input.raceId, userId },
          })
        : Promise.resolve(null),
      input.trainingProposalId
        ? db.changeProposal.findFirst({
            where: { id: input.trainingProposalId, userId },
            include: { baseVersion: true },
          })
        : Promise.resolve(null),
    ]);
    if (!nutritionProfile)
      throw new BadRequestException({
        code: "NUTRITION_PROFILE_REQUIRED",
        message: "请先建立饮食档案",
      });
    const nutritionVersion = nutritionPlan?.activeVersion?.versionNo ?? 0;
    if (nutritionVersion !== input.expectedNutritionVersion)
      throw new ConflictException({
        code: "NUTRITION_VERSION_CONFLICT",
        message: "正式营养计划已更新，请重新生成",
      });
    if (input.mode === "INITIAL" && nutritionVersion !== 0)
      throw new ConflictException({
        code: "NUTRITION_PLAN_EXISTS",
        message: "已有正式营养计划，请使用重新生成场景",
      });
    if (input.mode === "REGENERATE" && nutritionVersion === 0)
      throw new ConflictException({
        code: "NUTRITION_PLAN_NOT_FOUND",
        message: "尚无正式营养计划，请使用首次生成场景",
      });
    const trainingVersion = plan?.activeVersion?.versionNo ?? 0;
    if (
      input.expectedTrainingPlanVersion !== undefined &&
      trainingVersion !== input.expectedTrainingPlanVersion
    )
      throw new ConflictException({
        code: "PLAN_VERSION_CONFLICT",
        message: "正式训练计划已更新，请重新生成",
      });
    if (input.trainingProposalId && input.mode !== "TRAINING_LINKED")
      throw new BadRequestException({
        code: "INVALID_TRAINING_LINK_MODE",
        message: "trainingProposalId 只能用于训练联动场景",
      });
    if (input.trainingProposalId && input.workoutId)
      throw new BadRequestException({
        code: "DUPLICATE_TRAINING_CONTEXT",
        message: "trainingProposalId 不能与 workoutId 同时使用",
      });
    if (
      input.mode === "TRAINING_LINKED" &&
      input.expectedTrainingPlanVersion === undefined
    )
      throw new BadRequestException({
        code: "PLAN_VERSION_REQUIRED",
        message: "训练联动场景需要 expectedTrainingPlanVersion",
      });
    if (input.trainingProposalId) {
      if (!trainingProposal)
        throw new NotFoundException({
          code: "TRAINING_PROPOSAL_NOT_FOUND",
          message: "训练提案不存在",
        });
      if (!trainingProposal.proposalType.startsWith("AI_"))
        throw new ConflictException({
          code: "TRAINING_PROPOSAL_NOT_SUPPORTED",
          message: "当前只支持从 AI 训练提案生成营养联动草稿",
        });
      if (!["READY", "APPLIED"].includes(trainingProposal.status))
        throw new ConflictException({
          code: "TRAINING_PROPOSAL_NOT_READY",
          message: "训练提案尚未通过校验",
        });
      if (
        ((trainingProposal.status === "APPLIED"
          ? trainingProposal.appliedVersionId
          : trainingProposal.baseVersionId) ?? null) !==
        (plan?.activeVersionId ?? null)
      )
        throw new ConflictException({
          code: "PLAN_VERSION_CONFLICT",
          message: "训练提案基于旧版本，请重新生成",
        });
    }
    if (input.mode === "RACE_LINKED" && (!input.raceId || !race))
      throw new NotFoundException({
        code: "RACE_NOT_FOUND",
        message: "赛事不存在",
      });
    if (input.mode === "RACE_LINKED" && race?.status === "CANCELLED")
      throw new ConflictException({
        code: "RACE_CANCELLED",
        message: "赛事已取消，请调整日常饮食，不再生成该赛事的补给",
      });
    const selectedWorkout = input.workoutId
      ? workouts.find((workout) => workout.id === input.workoutId)
      : null;
    if (input.workoutId && !selectedWorkout)
      throw new NotFoundException({
        code: "WORKOUT_NOT_FOUND",
        message: "训练课程不存在",
      });
    return {
      trainingContext: {
        planVersionId: plan?.activeVersionId ?? null,
        planVersion: trainingVersion,
        ...(input.trainingProposalId
          ? { trainingProposalId: input.trainingProposalId }
          : {}),
        dateSignatures: trainingDateSignatures(
          input.startDate,
          input.endDate,
          workouts,
        ),
      },
      timezone: user.timezone,
      locale: user.locale,
      profileVersion: user.profileVersion,
      nutritionProfile,
      athleteProfile: athleteProfile
        ? {
            heightCm: athleteProfile.heightCm
              ? Number(athleteProfile.heightCm)
              : null,
            weightKg: athleteProfile.weightKg
              ? Number(athleteProfile.weightKg)
              : null,
            ageBand: athleteProfile.ageBand,
            experienceLevel: athleteProfile.experienceLevel,
          }
        : null,
      trainingPlanVersion: trainingVersion,
      workouts: workouts.map((workout) => ({
        id: workout.id,
        scheduledDate: dbToDate(workout.scheduledDate),
        title: workout.title,
        purpose: workout.purpose,
        timeTargetMin: workout.timeTargetMin
          ? Number(workout.timeTargetMin)
          : null,
        distanceTargetKm: workout.distanceTargetKm
          ? Number(workout.distanceTargetKm)
          : null,
        structure: workout.structure,
      })),
      selectedWorkout: selectedWorkout
        ? {
            id: selectedWorkout.id,
            scheduledDate: dbToDate(selectedWorkout.scheduledDate),
            title: selectedWorkout.title,
            purpose: selectedWorkout.purpose,
            structure: selectedWorkout.structure,
          }
        : null,
      trainingChange: trainingProposal
        ? {
            proposalId: trainingProposal.id,
            proposalType: trainingProposal.proposalType,
            status: trainingProposal.status,
            basePlanVersion: trainingProposal.baseVersion?.versionNo ?? 0,
            original: trainingProposal.original,
            draft: trainingProposal.draft,
          }
        : null,
      race: race
        ? {
            id: race.id,
            name: race.name,
            localDate: dbToDate(race.localDate),
            distanceKm: Number(race.distanceKm),
            priority: race.priority,
          }
        : null,
      existingNutritionPlan: nutritionPlan
        ? {
            version: nutritionVersion,
            items:
              nutritionPlan.activeVersion?.items.map((item) => ({
                id: item.id,
                localDate: dbToDate(item.localDate),
                mealType: item.mealType,
                title: item.title,
                scheduledLocalTime: item.scheduledLocalTime,
                linkedWorkoutId: item.linkedWorkoutId,
                notes: item.notes,
                foods: item.foods,
                nutrients: item.nutrients,
              })) ?? [],
          }
        : null,
    };
  }
}
