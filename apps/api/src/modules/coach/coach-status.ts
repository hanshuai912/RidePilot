import type { CoachOverview } from "@ridepilot/contracts";
import type {
  TrainingActivity,
  TrainingAssessment,
  TrainingRaceResult,
} from "../../generated/prisma/client";
import { dbToDate } from "../training/training.validation";

export function localCoachDate(now: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function coachStatus(
  today: string,
  activities: TrainingActivity[],
  races: (TrainingRaceResult & { race: { name: string } })[],
  assessments: TrainingAssessment[],
  appliedAt: Date | null,
): CoachOverview["status"] {
  const effort = (rpe: number | null, fatigue: number | null) =>
    `${rpe === null ? "未填 RPE" : `RPE ${rpe}/10`}${fatigue === null ? " · 未填疲劳" : ` · 疲劳 ${fatigue}/10`}`;
  const evidence: CoachOverview["status"]["evidence"] = [
    ...activities.map((a) => ({
      id: a.id,
      date: dbToDate(a.localDate),
      title: "训练反馈",
      kind: "ACTIVITY" as const,
      detail: `${({ COMPLETED: "完成", PARTIAL: "部分完成", SKIPPED: "跳过" } as Record<string, string>)[a.status] ?? a.status} · ${effort(a.rpe, a.fatigue)}`,
    })),
    ...races.map((r) => ({
      id: r.raceId,
      date: dbToDate(r.actualDate),
      title: r.race.name,
      kind: "RACE" as const,
      detail: effort(r.rpe, r.fatigue),
    })),
    ...assessments.map((a) => ({
      id: a.id,
      date: dbToDate(a.actualDate ?? a.localDate),
      title: a.protocol,
      kind: "ASSESSMENT" as const,
      detail: a.resultWatts
        ? `测试结果 ${Number(a.resultWatts)} W`
        : "已记录测试结果",
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  const recent = new Date(`${today}T00:00:00Z`);
  recent.setUTCDate(recent.getUTCDate() - 2);
  const feedback = [
    ...activities.map((a) => ({
      date: a.localDate,
      fatigue: a.fatigue,
      reportedAt: a.createdAt,
    })),
    ...races.map((r) => ({
      date: r.actualDate,
      fatigue: r.fatigue,
      reportedAt: r.updatedAt,
    })),
  ]
    .filter((a) => a.date >= recent && a.fatigue !== null)
    .sort(
      (a, b) =>
        b.date.getTime() - a.date.getTime() ||
        b.reportedAt.getTime() - a.reportedAt.getTime(),
    );
  if (feedback[0]?.fatigue !== null && (feedback[0]?.fatigue ?? 0) >= 7)
    return {
      code: "RECOVERING",
      label: "建议关注恢复",
      explanation:
        "最近三天最新疲劳反馈较高（≥7/10），可主动选择恢复或调整；RPE 不等同于疲劳。",
      evidence,
    };
  if (assessments.some((a) => !appliedAt || a.updatedAt > appliedAt))
    return {
      code: "REASSESS",
      label: "建议复评",
      explanation:
        "最近七天有晚于当前计划应用时间的测试结果，可查看结果并决定是否调整。",
      evidence,
    };
  if (feedback.length)
    return {
      code: "STABLE",
      label: "近期疲劳反馈平稳",
      explanation:
        "最近三天最新已填疲劳低于7/10，仅依据主观反馈，不代表已评估全部身体状态。",
      evidence,
    };
  return {
    code: "INSUFFICIENT",
    label: "暂无充分状态依据",
    explanation:
      "最近三天缺少疲劳反馈。下方展示最近七天记录，不能仅根据计划或 RPE 判断恢复状态。",
    evidence,
  };
}
