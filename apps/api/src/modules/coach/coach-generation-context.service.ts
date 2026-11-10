import { assertPlanImpact } from "./plan-impact/plan-impact.repository";
import { resolveCycleReview } from "./cycle-review/cycle-review.evidence";
import { resolveStageReview } from "./goals/stage-review.repository";
import { assertStageReviewScope } from "./goals/stage-review.scope";
import { racePlanningWindow } from "./race-planning.validation";
import { AssessmentReviewService } from "./assessment-review.service";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { WeekGenerationInput } from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { workoutActivities } from "../training/workout-activity";
import { dbToDate } from "../training/training.validation";
import { CoachDataService } from "./coach-data.service";
import type { WeeklyAvailabilitySlot } from "./coach-plan.validator";
import { TrainingRangeService } from "./training-range.service";
import { assertDateRange } from "./stage-plan.validation";
import { retainedHardDates } from "./retained-training";
import {
  readPlanningGoals,
  primaryPlanningGoal,
  planningHorizon,
} from "./goals/planning-goals";

@Injectable()
export class CoachGenerationContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: CoachDataService,
    private readonly ranges: TrainingRangeService,
    private readonly reviews: AssessmentReviewService,
  ) {}
  async load(
    userId: string,
    input: WeekGenerationInput,
    scene:
      | "WEEK_PLAN"
      | "RANGE_PLAN"
      | "WORKOUT_ADJUST"
      | "PLAN_ADJUST"
      | "ASSESSMENT_REVIEW"
      | "RACE_REPLAN",
  ) {
    if (
      input.stageReviewId &&
      (scene !== "RANGE_PLAN" ||
        input.mode !== "range" ||
        input.cycleReview ||
        input.relatedId ||
        input.racePhase)
    )
      throw new BadRequestException({
        code: "STAGE_REVIEW_SCOPE",
        message: "阶段复评只能用于独立的后续范围课程",
      });
    if (
      input.planImpact &&
      (scene !== "RANGE_PLAN" ||
        input.mode !== "range" ||
        input.stageId ||
        input.stageReviewId ||
        input.cycleReview ||
        input.relatedId ||
        input.targetWorkoutId ||
        input.racePhase ||
        input.reason ||
        input.planImpact.startDate !== input.weekStartDate ||
        input.planImpact.endDate !== input.endDate)
    )
      throw new BadRequestException({
        code: "INVALID_IMPACT_SCOPE",
        message: "资料变更只能用于独立的日期范围重排",
      });
    const impact = input.planImpact
      ? await assertPlanImpact(this.prisma, userId, input.planImpact)
      : null;
    const stageReview = input.stageReviewId
      ? await resolveStageReview(this.prisma, userId, input.stageReviewId)
      : undefined;
    if (stageReview) assertStageReviewScope(stageReview, input);
    if (
      input.cycleReview &&
      (scene !== "RANGE_PLAN" ||
        input.mode !== "range" ||
        input.stageId ||
        input.relatedId ||
        input.targetWorkoutId ||
        input.racePhase)
    )
      throw new BadRequestException({
        code: "INVALID_GENERATION_MODE",
        message: "周期复盘只支持独立的日期范围生成",
      });
    if (input.symptomFlags?.length)
      throw new BadRequestException({
        code: "TRAINING_SAFETY_BLOCKED",
        message: "存在明显不适，请暂停高强度训练并寻求适当医疗帮助",
      });
    if (
      scene === "WEEK_PLAN" &&
      !["initial", "empty_week"].includes(input.mode)
    )
      throw new BadRequestException({
        code: "INVALID_GENERATION_MODE",
        message: "请选择首份计划或空白未来周",
      });
    if (
      !["WEEK_PLAN", "RANGE_PLAN"].includes(scene) &&
      !(
        scene === "RACE_REPLAN"
          ? ["replace_week", "range"]
          : ["replace_week", "replace_workout"]
      ).includes(input.mode)
    )
      throw new BadRequestException({
        code: "INVALID_GENERATION_MODE",
        message: "请选择调整范围",
      });
    if (
      scene === "WORKOUT_ADJUST" &&
      (!input.targetWorkoutId || input.mode !== "replace_workout")
    )
      throw new BadRequestException({
        code: "WORKOUT_REQUIRED",
        message: "请选择要调整的课程",
      });
    if (
      ["ASSESSMENT_REVIEW", "RACE_REPLAN"].includes(scene) &&
      !input.relatedId
    )
      throw new BadRequestException({
        code: "RELATED_EVENT_REQUIRED",
        message: "缺少测试或赛事",
      });
    if (
      (scene !== "RACE_REPLAN" &&
        (scene === "RANGE_PLAN") !== (input.mode === "range")) ||
      (input.mode !== "range" && (input.endDate || input.stageId))
    )
      throw new BadRequestException({
        code: "INVALID_GENERATION_MODE",
        message: "范围生成请使用范围接口",
      });
    if (scene !== "RACE_REPLAN" && input.racePhase)
      throw new BadRequestException({
        code: "INVALID_GENERATION_MODE",
        message: "赛事参数只能用于赛事规划",
      });
    if (input.mode === "range") {
      if (!input.endDate)
        throw new BadRequestException({
          code: "INVALID_DATE_RANGE",
          message: "请选择结束日期",
        });
      assertDateRange(input.weekStartDate, input.endDate, 84);
      if (input.stageId) {
        const resolved = await this.ranges.resolve(userId, {
          scope: "STAGE",
          goalId: input.goalId,
          stageId: input.stageId,
          expectedBaseVersion: input.expectedBaseVersion,
          ...(input.stageReviewId
            ? { stageReviewId: input.stageReviewId }
            : {}),
        });
        if (
          resolved.weekStartDate !== input.weekStartDate ||
          resolved.endDate !== input.endDate
        )
          throw new ConflictException({
            code: "STAGE_PLAN_STALE",
            message: "阶段日期已变化，请重新生成",
          });
      }
    }
    const readiness = await this.data.readiness(userId);
    if (readiness.missingFields.includes("ftp"))
      throw new BadRequestException({
        code: "FTP_REQUIRED",
        missingFields: ["ftp"],
        message: "请先设置 FTP，再生成或调整训练",
      });
    if (!readiness.ready)
      throw new BadRequestException({
        code: "INSUFFICIENT_TRAINING_INPUT",
        missingFields: readiness.missingFields,
        message: "请先补全训练资料",
      });
    const [
      ftp,
      selectedGoal,
      availability,
      profile,
      user,
      plan,
      races,
      assessments,
      planningGoals,
    ] = await Promise.all([
      this.data.latestFtp(userId),
      this.data.getGoal(userId, input.goalId),
      this.prisma.trainingAvailability.findUnique({ where: { userId } }),
      this.prisma.athleteProfile.findUnique({ where: { userId } }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { profileVersion: true, timezone: true },
      }),
      this.data.activePlan(userId),
      this.prisma.trainingRace.findMany({
        where: { userId, status: "CONFIRMED" },
      }),
      this.prisma.trainingAssessment.findMany({
        where: { userId, status: { in: ["SCHEDULED", "POSTPONED"] } },
      }),
      readPlanningGoals(this.prisma, userId),
    ]);
    if (selectedGoal.status !== "ACTIVE")
      throw new ConflictException({
        code: "GOAL_NOT_ACTIVE",
        message: "请选择进行中的目标",
      });
    const goal = primaryPlanningGoal(planningGoals);
    if (
      scene === "RANGE_PLAN" &&
      input.endDate &&
      input.endDate > planningHorizon(planningGoals)
    )
      throw new BadRequestException({
        code: "INVALID_DATE_RANGE",
        message: "课程日期不能超过全部进行中目标的最晚期限",
      });
    if (!ftp || !availability || !profile?.experienceLevel)
      throw new BadRequestException({
        code: "INSUFFICIENT_TRAINING_INPUT",
        message: "训练资料不完整",
      });
    if (goal.status !== "ACTIVE")
      throw new ConflictException({
        code: "GOAL_NOT_ACTIVE",
        message: "目标不是活跃状态",
      });
    const weightKg = profile.weightKg ? Number(profile.weightKg) : null;
    if (planningGoals.some((g) => g.targetWkg) && !weightKg)
      throw new BadRequestException({
        code: "INSUFFICIENT_TRAINING_INPUT",
        missingFields: ["weightKg"],
        message: "功体比目标需要体重",
      });
    const version = plan?.activeVersion?.versionNo ?? 0;
    if (
      version !== input.expectedBaseVersion ||
      (input.mode === "initial" && version !== 0) ||
      (input.mode === "empty_week" && version === 0) ||
      (["replace_week", "replace_workout"].includes(input.mode) &&
        scene !== "RACE_REPLAN" &&
        version === 0)
    ) {
      throw new ConflictException({
        code: "PLAN_VERSION_CONFLICT",
        message: "计划版本已改变",
      });
    }
    const start = new Date(`${input.weekStartDate}T00:00:00.000Z`);
    if (
      Number.isNaN(start.getTime()) ||
      (!input.endDate && start.getUTCDay() !== 1)
    )
      throw new BadRequestException({
        code: "INVALID_WEEK_START",
        message: "请选择周一作为开始日期",
      });
    const localToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const localTodayDate = new Date(`${localToday}T00:00:00.000Z`);
    const currentWeekMonday = new Date(
      localTodayDate.getTime() -
        ((localTodayDate.getUTCDay() + 6) % 7) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    if ((input.endDate ?? input.weekStartDate) < currentWeekMonday)
      throw new ConflictException({
        code: "HISTORICAL_WEEK_NOT_EDITABLE",
        message: "请选择本周或未来周",
      });
    const end =
      input.endDate ??
      new Date(start.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
    const existingWorkouts =
      plan?.activeVersion?.workouts.filter((workout) => {
        const day = workout.scheduledDate.toISOString().slice(0, 10);
        return day >= input.weekStartDate && day <= end;
      }) ?? [];
    const recordedIds = await workoutActivities(
      this.prisma,
      userId,
      existingWorkouts,
    );
    const editable = existingWorkouts.filter(
      (item) =>
        dbToDate(item.scheduledDate) >= localToday && !recordedIds.has(item.id),
    );
    if (input.mode === "initial" && existingWorkouts.length)
      throw new ConflictException({
        code: "WEEK_NOT_EMPTY",
        message: "该周已有课程，请使用调整入口",
      });
    if (input.mode === "empty_week" && editable.length)
      throw new ConflictException({
        code: "WEEK_NOT_EMPTY",
        message: "该周仍有可调整课程，请使用调整入口",
      });
    const replaceWorkoutIds =
      input.mode === "replace_workout"
        ? editable
            .filter((item) => item.id === input.targetWorkoutId)
            .map((item) => item.id)
        : ["replace_week", "range"].includes(input.mode)
          ? editable.map((item) => item.id)
          : [];
    if (
      ["replace_week", "replace_workout"].includes(input.mode) &&
      scene !== "RACE_REPLAN" &&
      !replaceWorkoutIds.length
    )
      throw new ConflictException({
        code: "NO_EDITABLE_WORKOUTS",
        message: "该范围没有可调整的未来课程",
      });
    let relatedEvent: Record<string, unknown> | null = null;
    if (
      scene === "ASSESSMENT_REVIEW" ||
      (scene === "RANGE_PLAN" && input.relatedId)
    ) {
      const review = await this.reviews.review(userId, input.relatedId!);
      const assessment = review.assessment;
      if (input.relatedVersion && input.relatedVersion !== assessment.version)
        throw new ConflictException({
          code: "ASSESSMENT_VERSION_CONFLICT",
          message: "测试已变化，请重新复评",
        });
      if (
        ![
          "COMPLETED",
          "POSTPONED",
          "INCOMPLETE",
          "SKIPPED",
          "INVALID",
        ].includes(assessment.status)
      )
        throw new ConflictException({
          code: "ASSESSMENT_NOT_REVIEWABLE",
          message: "测试结果尚不可复评",
        });
      relatedEvent = {
        ...assessment,
        reviewEvidence: {
          previous: review.previous,
          comparison: review.comparison,
          training: review.training,
          messages: review.messages,
        },
      };
    }
    if (scene === "RACE_REPLAN") {
      const race = await this.prisma.trainingRace.findFirst({
        where: { id: input.relatedId, userId },
        include: { result: true },
      });
      if (!race)
        throw new NotFoundException({
          code: "RACE_NOT_FOUND",
          message: "赛事不存在",
        });
      racePlanningWindow(race, localToday, input.racePhase);
      if (input.relatedVersion && input.relatedVersion !== race.version)
        throw new ConflictException({
          code: "RACE_VERSION_CONFLICT",
          message: "赛事或结果已变化，请重新生成",
        });
      relatedEvent = {
        phase: input.racePhase,
        id: race.id,
        version: race.version,
        name: race.name,
        localDate: dbToDate(race.localDate),
        priority: race.priority,
        distanceKm: Number(race.distanceKm),
        elevationGainM: race.elevationGainM
          ? Number(race.elevationGainM)
          : null,
        intent: race.intent,
        timezone: race.timezone,
        status: race.status,
        result: race.result
          ? {
              status: race.result.status,
              actualDate: dbToDate(race.result.actualDate),
              durationSeconds: race.result.durationSeconds,
              rpe: race.result.rpe,
              fatigue: race.result.fatigue,
              notes: race.result.notes,
            }
          : null,
      };
    }
    if (scene === "PLAN_ADJUST" && input.relatedId) {
      const activity = await this.prisma.trainingActivity.findFirst({
        where: { id: input.relatedId, userId },
      });
      if (!activity)
        throw new NotFoundException({
          code: "ACTIVITY_NOT_FOUND",
          message: "训练记录不存在",
        });
      relatedEvent = {
        id: activity.id,
        status: activity.status,
        durationMin: activity.durationMin,
        rpe: activity.rpe,
        fatigue: activity.fatigue,
        localDate: dbToDate(activity.localDate),
      };
    }
    const forbiddenDates = [
      ...races.map((item) => item.localDate.toISOString().slice(0, 10)),
      ...assessments.map((item) => item.localDate.toISOString().slice(0, 10)),
    ].filter((day) => day >= input.weekStartDate && day <= end);
    for (
      let day = new Date(start);
      day.toISOString().slice(0, 10) < localToday &&
      day.toISOString().slice(0, 10) <= end;
      day = new Date(day.getTime() + 86_400_000)
    )
      forbiddenDates.push(day.toISOString().slice(0, 10));
    const availableWeekdays = new Set(
      (availability.weekdays as unknown as WeeklyAvailabilitySlot[]).map(
        (item) => item.weekday,
      ),
    );
    const availableDates: string[] = [];
    for (
      let day = new Date(start);
      day.toISOString().slice(0, 10) <= end;
      day = new Date(day.getTime() + 86_400_000)
    ) {
      const date = day.toISOString().slice(0, 10);
      if (
        date >= localToday &&
        availableWeekdays.has(day.getUTCDay()) &&
        !forbiddenDates.includes(date)
      ) {
        availableDates.push(date);
      }
    }
    if (
      (["empty_week", "range"].includes(input.mode) ||
        scene === "RACE_REPLAN") &&
      !availableDates.length
    )
      throw new ConflictException({
        code: "NO_REMAINING_TRAINING_DATES",
        message:
          input.mode === "range"
            ? "所选范围没有可训练日期，请选择后续阶段或调整日期"
            : "本周没有剩余可训练日期，请选择下周开始",
      });
    const cycleReview = input.cycleReview
      ? await resolveCycleReview(this.prisma, userId, input.cycleReview)
      : undefined;
    if (
      cycleReview &&
      (input.weekStartDate <= cycleReview.snapshot.endDate ||
        input.weekStartDate < localToday ||
        end > planningHorizon(planningGoals))
    )
      throw new BadRequestException({
        code: "INVALID_CYCLE_TARGET_RANGE",
        message: "后续训练须从今天或未来开始、晚于复盘结束日，且不超过目标日期",
      });
    if (cycleReview && cycleReview.snapshot.goal?.id !== input.goalId)
      throw new ConflictException({
        code: "CYCLE_REVIEW_STALE",
        message: "活跃目标已变化，请刷新复盘",
      });
    const stage = input.stageId
      ? await this.prisma.trainingStage.findFirst({
          where: {
            id: input.stageId,
            stagePlan: { userId, status: "ACTIVE" },
          },
          select: { title: true, purpose: true, assessmentSuggestion: true },
        })
      : null;
    return {
      ...(impact && input.planImpact
        ? {
            planImpact: {
              reference: input.planImpact,
              before: impact.preview.items.filter(
                (i) =>
                  i.workout.scheduledDate >= input.planImpact!.startDate &&
                  i.workout.scheduledDate <= input.planImpact!.endDate,
              ),
              ftpWatts: Number(ftp.value),
            },
          }
        : {}),
      ...(stageReview ? { stageReview } : {}),
      ...(cycleReview ? { cycleReview } : {}),
      stage,
      nearbyRaces:
        scene === "RACE_REPLAN"
          ? races
              .filter(
                (race) =>
                  race.id !== input.relatedId &&
                  dbToDate(race.localDate) >= input.weekStartDate &&
                  dbToDate(race.localDate) <= end,
              )
              .map((race) => ({
                id: race.id,
                date: dbToDate(race.localDate),
                name: race.name,
                priority: race.priority,
                distanceKm: Number(race.distanceKm),
              }))
          : [],
      ftp,
      goal: {
        id: goal.id,
        version: goal.version,
        type: goal.type,
        description: goal.description,
        successCriteria: goal.successCriteria,
        targetWkg: goal.targetWkg ? Number(goal.targetWkg) : null,
        targetFtpWatts:
          goal.targetFtpWatts ??
          (goal.targetWkg && weightKg
            ? Math.round(Number(goal.targetWkg) * weightKg)
            : null),
        targetDate: goal.targetDate,
      },
      planningGoals,
      availability,
      experienceLevel: profile.experienceLevel,
      profileVersion: user.profileVersion,
      bodyMetrics: {
        heightCm: profile.heightCm ? Number(profile.heightCm) : null,
        weightKg,
      },
      currentFtpWkg: weightKg
        ? Math.round((Number(ftp.value) / weightKg) * 100) / 100
        : null,
      plan,
      forbiddenDates,
      availableDates,
      replaceWorkoutIds,
      retainedHardDates: retainedHardDates(
        plan?.activeVersion?.workouts ?? [],
        replaceWorkoutIds,
        Number(ftp.value),
        input.weekStartDate,
        end,
      ),
      retainedMinutes: Object.fromEntries(
        existingWorkouts
          .filter((item) => !replaceWorkoutIds.includes(item.id))
          .reduce((entries, item) => {
            const date = dbToDate(item.scheduledDate);
            entries.set(
              date,
              (entries.get(date) ?? 0) +
                (item.timeTargetMin ? Number(item.timeTargetMin) : 0),
            );
            return entries;
          }, new Map<string, number>()),
      ),
      relatedEvent,
      existingWorkouts: existingWorkouts.map((item) => ({
        id: item.id,
        scheduledDate: dbToDate(item.scheduledDate),
        title: item.title,
        purpose: item.purpose,
        timeTargetMin: item.timeTargetMin ? Number(item.timeTargetMin) : null,
        structure: item.structure,
        editable: replaceWorkoutIds.includes(item.id),
      })),
    };
  }
}
