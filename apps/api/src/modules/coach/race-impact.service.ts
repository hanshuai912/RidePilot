import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dateToDb, dbToDate } from "../training/training.validation";
import { workoutActivities } from "../training/workout-activity";
import { racePlanningWindow } from "./race-planning.validation";
import { assertDateRange } from "./stage-plan.validation";

@Injectable()
export class RaceImpactService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    userId: string,
    id: string,
    range?: { startDate: string; endDate: string },
  ) {
    const race = await this.prisma.trainingRace.findFirst({
      where: { id, userId },
    });
    if (!race)
      throw new NotFoundException({
        code: "RACE_NOT_FOUND",
        message: "赛事不存在",
      });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const { startDate, endDate } = range ?? racePlanningWindow(race, today);
    assertDateRange(startDate, endDate, 84);
    const dates = { gte: dateToDb(startDate), lte: dateToDb(endDate) };
    const [plan, assessments, races, stages] = await Promise.all([
      this.prisma.trainingPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: {
          activeVersion: {
            include: { workouts: { where: { scheduledDate: dates } } },
          },
        },
      }),
      this.prisma.trainingAssessment.findMany({
        where: {
          userId,
          localDate: dates,
          status: { in: ["SCHEDULED", "POSTPONED"] },
        },
      }),
      this.prisma.trainingRace.findMany({
        where: {
          userId,
          id: { not: id },
          localDate: dates,
          status: "CONFIRMED",
        },
      }),
      this.prisma.trainingStage.findMany({
        where: {
          stagePlan: { userId, status: "ACTIVE" },
          startDate: { lte: dates.lte },
          endDate: { gte: dates.gte },
        },
        orderBy: { startDate: "asc" },
      }),
    ]);
    const workouts = plan?.activeVersion?.workouts ?? [];
    const records = await workoutActivities(this.prisma, userId, workouts);
    const raceDate = dbToDate(race.localDate);
    const conflicts = [
      ...workouts
        .filter(
          (item) =>
            race.status === "CONFIRMED" &&
            dbToDate(item.scheduledDate) === raceDate,
        )
        .map((item) => ({
          date: raceDate,
          kind: "WORKOUT" as const,
          title: item.title ?? "骑行训练",
          severity: "BLOCKER" as const,
        })),
      ...assessments.map((item) => ({
        date: dbToDate(item.localDate),
        kind: "ASSESSMENT" as const,
        title: `阶段测试 · ${item.protocol}`,
        severity: "WARNING" as const,
      })),
      ...races.map((item) => ({
        date: dbToDate(item.localDate),
        kind: "RACE" as const,
        title: `赛事 · ${item.name}（${item.priority} 级）`,
        severity:
          item.localDate.getTime() === race.localDate.getTime() &&
          race.status === "CONFIRMED"
            ? ("BLOCKER" as const)
            : ("WARNING" as const),
      })),
    ];
    const affectedDates: string[] = [];
    for (
      let day = Date.parse(startDate);
      day <= Date.parse(endDate);
      day += 86_400_000
    )
      affectedDates.push(new Date(day).toISOString().slice(0, 10));
    return {
      race: {
        id: race.id,
        name: race.name,
        timezone: race.timezone,
        type: race.type,
        priority: race.priority,
        intent: race.intent,
        status: race.status,
        version: race.version,
        localDate: raceDate,
        distanceKm: Number(race.distanceKm),
        elevationGainM:
          race.elevationGainM == null ? null : Number(race.elevationGainM),
      },
      startDate,
      endDate,
      affectedDates,
      conflicts,
      currentTrainingVersion: plan?.activeVersion?.versionNo ?? 0,
      requiresReplan: true,
      workouts: workouts.map((item) => ({
        id: item.id,
        date: dbToDate(item.scheduledDate),
        title: item.title ?? "骑行训练",
        retained: dbToDate(item.scheduledDate) < today || records.has(item.id),
      })),
      stages: stages.map((item) => ({
        id: item.id,
        title: item.title,
        startDate: dbToDate(item.startDate),
        endDate: dbToDate(item.endDate),
      })),
      messages: [
        "仅范围内未来且未记录的课程可被替换；历史与已记录课程保留。",
        ...(races.length
          ? [
              "范围内还有其他赛事，请结合 A/B/C 优先级取舍备赛与恢复；草稿需同时考虑这些比赛。",
            ]
          : []),
        ...(assessments.length
          ? [
              "测试日程保留，生成课程会避开测试日期。若需改期，请先到测试详情调整，再重新生成。",
            ]
          : []),
        ...(stages.length
          ? ["训练草稿提供阶段建议，正式阶段安排仍需在目标详情单独确认。"]
          : []),
        "补给方案独立确认；赛事改期、取消或训练变化后，请检查补给是否仍适用。",
      ],
    };
  }
}
