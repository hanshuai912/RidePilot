import {
  cycleReviewSnapshotSchema,
  type CycleReviewSnapshot,
} from "@ridepilot/contracts";
import { generationFingerprint } from "../../../infra/prisma/generation-candidates";
import { activityWorkoutId } from "../../training/workout-activity";
import { dbToDate } from "../../training/training.validation";
import type { CycleReviewData } from "./cycle-review.repository";

export function buildCycleReview(data: CycleReviewData): CycleReviewSnapshot {
  const feedback = (r: CycleReviewData["records"][number]) => ({
    id: r.id,
    date: dbToDate(r.localDate),
    status: r.status,
    durationMin: r.durationMin,
    rpe: r.rpe,
    fatigue: r.fatigue,
    notes: r.notes,
  });
  const records = new Map(data.records.map((r) => [r.workoutId, r]));
  const seen = new Set<string>();
  const workouts = [...data.active, ...data.originals]
    .flatMap((w) => {
      const identity = activityWorkoutId(w);
      if (seen.has(identity)) return [];
      seen.add(identity);
      const record = records.get(identity);
      const inCurrentPlan = data.active.some((a) => a.id === w.id);
      return [
        {
          id: w.id,
          date: dbToDate(w.scheduledDate),
          title: w.title || "骑行训练",
          plannedMinutes:
            w.timeTargetMin === null ? null : Number(w.timeTargetMin),
          inCurrentPlan,
          canRecord: inCurrentPlan && !record,
          feedback: record ? feedback(record) : null,
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const additionalFeedback = data.records
    .filter((r) => !r.workoutId || !seen.has(r.workoutId))
    .map(feedback);
  const statusCount = (status: string) =>
    workouts.filter((w) => w.feedback?.status === status).length;
  const plannedDurations = workouts.flatMap((w) =>
    w.plannedMinutes === null ? [] : [w.plannedMinutes],
  );
  const actualDurations = data.records.flatMap((r) =>
    r.durationMin === null ? [] : [r.durationMin],
  );
  const paired = workouts.filter(
    (w) => w.plannedMinutes !== null && w.feedback?.durationMin != null,
  );
  const rpe = data.records.flatMap((r) => (r.rpe === null ? [] : [r.rpe]));
  const fatigue = data.records.flatMap((r) =>
    r.fatigue === null ? [] : [r.fatigue],
  );
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const average = (v: number[]) =>
    v.length ? Math.round((sum(v) / v.length) * 10) / 10 : null;
  const recentFatigue = data.recent.find((r) => r.fatigue !== null);
  const lastTwo = data.records.slice(-2);
  const recommendation: CycleReviewSnapshot["recommendation"] =
    recentFatigue && recentFatigue.fatigue! >= 7
      ? {
          code: "RECOVERY",
          label: "优先评估恢复",
          reasons: [
            `${dbToDate(recentFatigue.localDate)} 最新已填疲劳为 ${recentFatigue.fatigue}/10；这是主观反馈，可选择恢复草稿，不据此诊断。`,
          ],
        }
      : lastTwo.length === 2 &&
          lastTwo.every((r) => ["PARTIAL", "SKIPPED"].includes(r.status))
        ? {
            code: "ADJUST",
            label: "建议调整后续安排",
            reasons: [
              "本周期最后两次已记录训练均为部分完成或跳过，可检查时间安排和课程难度；未记录课程不参与该判断。",
            ],
          }
        : data.records.length === 0 || !recentFatigue
          ? {
              code: "INSUFFICIENT",
              label: "补充反馈后再判断",
              reasons: [
                data.records.length === 0
                  ? "本周期没有已保存训练反馈，未记录不等于未完成。"
                  : "最近三天缺少已填疲劳，不能只凭完成率或 RPE 判断恢复。",
              ],
            }
          : {
              code: "CONTINUE",
              label: "可沿用目标规划后续",
              reasons: [
                "近期最新已填疲劳低于7/10，且没有命中上述调整条件；仅表示当前记录未触发提示，不代表能力已提升或身体已全面评估。",
              ],
            };
  const stageValid =
    data.roadmap &&
    data.roadmapGoalsCurrent &&
    data.roadmap.goalVersion === data.goal?.version &&
    data.roadmap.profileVersion === data.user.profileVersion &&
    data.roadmap.availabilityVersion === data.availability?.version &&
    data.roadmap.ftpMeasurementId === data.ftp[0]?.id;
  const stage = stageValid
    ? data.roadmap?.stages.find(
        (s) =>
          dbToDate(s.startDate) <= data.endDate &&
          dbToDate(s.endDate) >= data.startDate,
      )
    : null;
  const missingFields = [
    ...(!data.goal ? ["goal"] : []),
    ...(!data.ftp[0] || Number(data.ftp[0].value) <= 0 ? ["ftp"] : []),
    ...(!data.availability ? ["availability"] : []),
    ...(!data.profile?.experienceLevel ? ["experienceLevel"] : []),
    ...(data.goal?.targetWkg && !data.profile?.weightKg ? ["weightKg"] : []),
  ];
  const value = {
    startDate: data.startDate,
    endDate: data.endDate,
    localDate: data.today,
    timezone: data.user.timezone,
    planVersion: data.plan?.activeVersion?.versionNo ?? 0,
    goal: data.goal
      ? {
          id: data.goal.id,
          title: data.goal.description || data.goal.type,
        }
      : null,
    stage: stage
      ? {
          title: stage.title,
          startDate: dbToDate(stage.startDate),
          endDate: dbToDate(stage.endDate),
        }
      : null,
    missingFields,
    stats: {
      planned: workouts.length,
      completed: statusCount("COMPLETED"),
      partial: statusCount("PARTIAL"),
      skipped: statusCount("SKIPPED"),
      unrecorded: workouts.filter((w) => !w.feedback).length,
      completionRate: workouts.length
        ? Math.round((statusCount("COMPLETED") / workouts.length) * 1000) / 10
        : null,
      plannedMinutes: plannedDurations.length ? sum(plannedDurations) : null,
      plannedDurationCount: plannedDurations.length,
      actualMinutes: actualDurations.length ? sum(actualDurations) : null,
      actualDurationCount: actualDurations.length,
      pairedMinutesDelta: paired.length
        ? sum(paired.map((w) => w.feedback!.durationMin! - w.plannedMinutes!))
        : null,
      pairedDurationCount: paired.length,
      rpeAverage: average(rpe),
      rpeCount: rpe.length,
      fatigueAverage: average(fatigue),
      fatigueCount: fatigue.length,
      additionalRecords: additionalFeedback.length,
    },
    workouts,
    additionalFeedback,
    recentFeedback: data.recent.map(feedback),
    // Tests remain a calendar suggestion. Their results are deliberately not
    // part of cycle-review evidence or generation decisions.
    tests: [],
    ftp: data.ftp[0]
      ? {
          valueWatts: Number(data.ftp[0].value),
          measuredAt: data.ftp[0].measuredAt.toISOString(),
          source: data.ftp[0].source,
          previousWatts: data.ftp[1] ? Number(data.ftp[1].value) : null,
          previousMeasuredAt: data.ftp[1]?.measuredAt.toISOString() ?? null,
          deltaWatts: data.ftp[1]
            ? Number(data.ftp[0].value) - Number(data.ftp[1].value)
            : null,
        }
      : null,
    recommendation,
    notices: [
      "完成率为完成课程数 / 本周期计划课程数；部分完成、跳过和未记录分别列出，未记录不视为失败。",
      "实际时长仅累加已填数值；差值仅比较同时有计划和实际时长的课程，不用缺失值补零。",
      "FTP 为最近两次手填或测试测量的实测差值，不等于本周期训练效果，也不用于预测达标日期。",
      "复盘按当前正式计划及原始已记录课程统计，跨版本复制课程按稳定训练记录身份去重；不会回写历史。",
      ...(!stage && data.roadmap
        ? ["阶段资料已变化或所选周期无匹配阶段，未将旧阶段作为当前执行依据。"]
        : []),
    ],
  };
  // Include versions and raw evidence too: a changed note or corrected test must
  // invalidate the candidate even when aggregate totals happen to stay equal.
  const fingerprint = generationFingerprint({
    value,
    planId: data.plan?.activeVersionId,
    profileVersion: data.user.profileVersion,
    availabilityVersion: data.availability?.version,
    goal: data.goal,
    ftp: data.ftp,
  });
  return cycleReviewSnapshotSchema.parse({ ...value, fingerprint });
}
