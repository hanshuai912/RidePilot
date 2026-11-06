import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  goalChangePreviewSchema,
  type GoalChange,
  type GoalEvaluation,
  type GoalInput,
} from "@ridepilot/contracts";
import { generationFingerprint } from "../../../infra/prisma/generation-candidates";
import { dbToDate } from "../../training/training.validation";
import { goalResponse, type GoalContext } from "./goal-lifecycle.repository";

export function validateGoalInput(input: GoalInput, today: string) {
  if (input.targetDate < today)
    throw new BadRequestException({
      code: "GOAL_DATE_IN_PAST",
      message: "目标日期不能早于今天，请先延期",
    });
  if (input.type !== "FTP" && (input.targetWkg || input.targetFtpWatts))
    throw new BadRequestException({
      code: "GOAL_METRIC_MISMATCH",
      message: "FTP 数值仅用于 FTP 目标，其他目标请填写可观察的达成条件",
    });
}

export function evaluateGoal(
  ctx: Pick<GoalContext, "ftp" | "profile" | "availability" | "localDate">,
  goal: GoalInput,
): GoalEvaluation {
  const current = ctx.ftp ? Number(ctx.ftp.value) : null;
  const weight = ctx.profile?.weightKg ? Number(ctx.profile.weightKg) : null;
  const daysRemaining = Math.round(
    (Date.parse(goal.targetDate) - Date.parse(ctx.localDate)) / 86400000,
  );
  const weekdays = ctx.availability?.weekdays as
    { availableMinutes: number }[] | undefined;
  return {
    localDate: ctx.localDate,
    daysRemaining,
    weeklyMinutes: weekdays
      ? weekdays.reduce((sum, slot) => sum + slot.availableMinutes, 0)
      : null,
    currentFtp: ctx.ftp
      ? {
          valueWatts: current!,
          measuredAt: ctx.ftp.measuredAt.toISOString(),
          source: ctx.ftp.source,
        }
      : null,
    wattsGap:
      current !== null && goal.targetFtpWatts
        ? goal.targetFtpWatts - current
        : null,
    wkgGap:
      current !== null && weight && goal.targetWkg
        ? Math.round((goal.targetWkg - current / weight) * 100) / 100
        : null,
    notices: [
      "难度需结合目标差距、期限、经验和可用训练时间判断；不预测固定增长速度或保证达成。可延长期限、调整目标或补充测试后再规划。",
      ...(daysRemaining <= 0
        ? ["目标已到期，请复评后选择完成、延期、结束或建立下一目标。"]
        : []),
      ...(!goal.successCriteria
        ? ["尚未填写可观察的达成条件，不能仅凭日期或完成率判断目标达成。"]
        : []),
      ...(!ctx.ftp ? ["缺少 FTP 基线，无法计算能力差距。"] : []),
      ...(goal.targetWkg
        ? ["功体比差距使用当前体重计算，不代表同日期的历史实测功体比。"]
        : []),
      ...(!ctx.availability || !ctx.profile?.experienceLevel
        ? ["训练时间或经验资料不完整，需完善后判断可执行性。"]
        : []),
      ...(goal.targetFtpWatts && goal.targetWkg
        ? [
            "同时填写两个 FTP 指标时，规划优先使用目标瓦数，功体比按当前体重单独核对。",
          ]
        : []),
      "能力差距、阶段达成和训练完成率分别解释，不能互相替代。",
    ],
  };
}

export function buildGoalPreview(ctx: GoalContext, change: GoalChange) {
  const before = goalResponse(ctx.goal);
  if (change.expectedVersion !== before.version)
    throw new ConflictException({
      code: "GOAL_VERSION_CONFLICT",
      message: "目标已更新，请刷新后重新预览",
    });
  if (change.action !== "CREATE_NEXT" && before.status === "CLOSED")
    throw new ConflictException({
      code: "GOAL_CLOSED",
      message: "已结束的目标保留为历史，请建立下一目标",
    });
  if (change.action === "CREATE_NEXT" && before.status !== "CLOSED")
    throw new ConflictException({
      code: "GOAL_NOT_CLOSED",
      message: "请先复评并完成或结束当前目标",
    });
  if (
    (change.action === "PAUSE" && before.status !== "ACTIVE") ||
    (change.action === "RESUME" && before.status !== "PAUSED")
  )
    throw new ConflictException({
      code: "GOAL_STATE_CONFLICT",
      message: "目标状态已变化，请刷新",
    });
  if (change.changes && !["UPDATE", "RESUME"].includes(change.action))
    throw new BadRequestException({
      code: "INVALID_GOAL_ACTION",
      message: "此操作不能同时修改目标条件",
    });
  if ((change.action === "CREATE_NEXT") !== !!change.nextGoal)
    throw new BadRequestException({
      code: "INVALID_GOAL_ACTION",
      message: "建立下一目标时需要完整的新目标条件",
    });
  const after = { ...before, ...change.changes, version: before.version + 1 };
  if (change.action === "PAUSE") after.status = "PAUSED";
  if (change.action === "RESUME") after.status = "ACTIVE";
  if (["COMPLETE", "CLOSE"].includes(change.action)) {
    after.status = "CLOSED";
    after.closureReason =
      change.action === "COMPLETE" ? "COMPLETED" : "STOPPED";
  }
  if (change.action === "COMPLETE" && !before.successCriteria)
    throw new BadRequestException({
      code: "GOAL_CRITERIA_REQUIRED",
      message: "请先填写达成条件，并在完成理由中说明实际证据",
    });
  if (["UPDATE", "RESUME"].includes(change.action))
    validateGoalInput(after, ctx.localDate);
  if (change.nextGoal) validateGoalInput(change.nextGoal, ctx.localDate);
  const demotes =
    (change.nextGoal ?? after).priority === "PRIMARY" &&
    (change.nextGoal || after.status === "ACTIVE");
  const data = {
    before,
    after,
    nextGoal: change.nextGoal ?? null,
    affected: {
      workouts: (ctx.plan?.activeVersion?.workouts ?? []).map((w) => ({
        id: w.id,
        date: dbToDate(w.scheduledDate),
        title: w.title || "骑行训练",
      })),
      assessments: ctx.assessments.map((a) => ({
        id: a.id,
        date: dbToDate(a.localDate),
        title: a.protocol,
      })),
      stages: ctx.stages.flatMap((p) =>
        p.stages.map((s) => ({ id: s.id, title: s.title })),
      ),
      otherPrimaryGoals: demotes ? ctx.otherPrimaryGoals.map(goalResponse) : [],
    },
    evaluation: evaluateGoal(ctx, change.nextGoal ?? after),
    warnings: [
      "本次保存目标状态与决策记录。正式课程、测试和营养仍按原安排执行；如需变更，请继续生成草稿并预览确认。",
      "目标条件变化后，相关阶段与未应用草稿需重新核对。未来课程属于当前完整计划，未必只服务本目标。",
      ...(demotes && ctx.otherPrimaryGoals.length
        ? [
            "确认后，其他活跃主目标改为次目标；已有课程保持现状，请检查目标之间的取舍。",
          ]
        : []),
      ...(change.action === "COMPLETE"
        ? ["完成状态由你根据达成条件和实际证据确认，不代表系统保证目标已达成。"]
        : []),
    ],
  };
  return goalChangePreviewSchema.parse({
    ...data,
    fingerprint: generationFingerprint({
      data,
      change,
      planVersion: ctx.plan?.activeVersionId,
      stages: ctx.stages,
      userVersion: ctx.user.profileVersion,
    }),
  });
}
