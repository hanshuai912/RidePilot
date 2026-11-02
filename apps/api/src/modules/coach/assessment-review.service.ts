import { Injectable } from "@nestjs/common";
import type { AssessmentReview } from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { workoutActivities } from "../training/workout-activity";
import { dateToDb, dbToDate } from "../training/training.validation";
import { assessmentResponse } from "./assessment.mapper";
import {
  AssessmentsService,
  assessmentDateInZone,
} from "./assessments.service";

@Injectable()
export class AssessmentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessments: AssessmentsService,
  ) {}

  async review(userId: string, id: string): Promise<AssessmentReview> {
    const item = await this.assessments.get(userId, id);
    const [goal, stage, ftp, user] = await Promise.all([
      item.goalId
        ? this.prisma.trainingGoal.findFirst({
            where: { id: item.goalId, userId },
          })
        : null,
      item.stageId
        ? this.prisma.trainingStage.findFirst({
            where: { id: item.stageId, stagePlan: { userId } },
          })
        : null,
      this.assessments.latestFtp(this.prisma, userId),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    const valid =
      item.status === "COMPLETED" &&
      item.kind !== "LEGACY" &&
      !!item.actualDate &&
      !!item.source &&
      !!item.rpe;
    const previous =
      valid && item.comparableConditions && item.conditions?.trim()
        ? await this.prisma.trainingAssessment.findFirst({
            where: {
              userId,
              id: { not: id },
              goalId: item.goalId,
              kind: item.kind,
              protocol: item.protocol,
              source: item.source,
              status: "COMPLETED",
              actualDate: { lt: item.actualDate! },
              rpe: { not: null },
              comparableConditions: true,
              conditions: item.conditions,
              ...(item.kind === "POWER_DURATION"
                ? { durationSeconds: item.durationSeconds }
                : {}),
              ...(item.kind === "FIXED_ROUTE"
                ? { routeName: item.routeName, distanceKm: item.distanceKm }
                : {}),
            },
            orderBy: [{ actualDate: "desc" }, { createdAt: "desc" }],
          })
        : null;
    let training: AssessmentReview["training"] = null;
    if (stage) {
      const startDate = dbToDate(stage.startDate);
      const endDate = [
        dbToDate(stage.endDate),
        item.actualDate
          ? dbToDate(item.actualDate)
          : assessmentDateInZone(new Date(), user.timezone),
      ].sort()[0];
      const workouts =
        endDate >= startDate
          ? await this.prisma.workout.findMany({
              where: {
                scheduledDate: {
                  gte: dateToDb(startDate),
                  lte: dateToDb(endDate),
                },
                planVersion: { activeForPlan: { userId, status: "ACTIVE" } },
              },
            })
          : [];
      const activities = await workoutActivities(this.prisma, userId, workouts);
      const records = [...activities.values()];
      training = {
        startDate,
        endDate,
        total: workouts.length,
        completed: records.filter((record) => record.status === "COMPLETED")
          .length,
        partial: records.filter((record) => record.status === "PARTIAL").length,
        skipped: records.filter((record) => record.status === "SKIPPED").length,
        unrecorded: workouts.length - records.length,
      };
    }
    const canUpdateFtp =
      valid &&
      item.kind === "FTP" &&
      !!item.resultWatts &&
      Number(item.resultWatts) >= 50 &&
      Number(item.resultWatts) <= 800 &&
      !item.ftpMeasurementId &&
      (!ftp ||
        assessmentDateInZone(ftp.measuredAt, user.timezone) <=
          dbToDate(item.actualDate!));
    const messages = [
      valid
        ? previous
          ? "已找到同目标、同方法、同来源且条件可比的历史测试，仅展示实测差值。"
          : "暂无可比较的历史结果，本次作为基线；不同方法、来源、条件或测试时长不直接比较。"
        : "当前测试不作为有效能力测量，不据此判断能力提升或目标达成。",
      "测试复评不会自动推进阶段或修改课程。后续课程需选择范围、预览并确认应用。",
      "训练完成情况按当前正式计划与已保存记录统计，截至实际测试日期；未记录不等于未完成。",
    ];
    if (item.kind === "POWER_DURATION")
      messages.push("平均功率是本次时长内的输出，不会换算成 FTP。");
    if (item.ftpMeasurementId)
      messages.push(
        item.status === "INVALID"
          ? "此结果曾确认更新 FTP。标记无效会保留测量历史，请在骑行功率设置中单独更正当前 FTP。"
          : "已确认保存 FTP；历史课程功率保持原有测量快照，新课程使用当前 FTP。",
      );
    if (item.kind === "FTP" && valid && !canUpdateFtp && !item.ftpMeasurementId)
      messages.push("已有日期较新的 FTP，本次结果仅保留为历史测量。");
    return {
      assessment: assessmentResponse(item),
      goalTitle: goal?.description || goal?.type || null,
      stageTitle: stage?.title ?? null,
      currentFtp: ftp
        ? {
            id: ftp.id,
            valueWatts: Number(ftp.value),
            measuredAt: ftp.measuredAt.toISOString(),
          }
        : null,
      previous: previous ? assessmentResponse(previous) : null,
      comparison: previous
        ? {
            wattsDelta:
              item.resultWatts !== null && previous.resultWatts !== null
                ? Number(item.resultWatts) - Number(previous.resultWatts)
                : null,
            secondsDelta:
              item.kind === "FIXED_ROUTE" &&
              item.durationSeconds &&
              previous.durationSeconds
                ? item.durationSeconds - previous.durationSeconds
                : null,
          }
        : null,
      training,
      canUpdateFtp,
      messages,
    };
  }
}
