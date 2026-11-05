import { cycleGoalTitle, cycleFtpSource } from "./cycle-review.model";
import type { CycleReviewSnapshot } from "@ridepilot/contracts";
import { AppText, Card } from "../../../components/ui";

export function CycleReviewSummary({
  review,
}: {
  review: CycleReviewSnapshot;
}) {
  const s = review.stats;
  return (
    <>
      <Card>
        <AppText variant="label" className="text-brand">
          {review.startDate} 至 {review.endDate} · {review.timezone}
        </AppText>
        <AppText variant="section" className="mt-2">
          {review.stage?.title ?? "训练周期复盘"}
        </AppText>
        <AppText muted className="mt-2">
          {review.goal ? cycleGoalTitle(review.goal.title) : "尚未设置活跃目标"}{" "}
          · 正式训练 v{review.planVersion}
        </AppText>
        <AppText className="mt-3">
          计划 {s.planned} 节 · 完成 {s.completed} · 部分完成 {s.partial}
        </AppText>
        <AppText className="mt-2">
          跳过 {s.skipped} · 未记录 {s.unrecorded} · 完成率{" "}
          {s.completionRate === null ? "暂无" : `${s.completionRate}%`}
        </AppText>
        <AppText className="mt-3">
          计划时长 {s.plannedMinutes ?? "—"} 分钟（{s.plannedDurationCount}{" "}
          节有值）
        </AppText>
        <AppText className="mt-2">
          实际时长 {s.actualMinutes ?? "—"} 分钟（{s.actualDurationCount}{" "}
          条有值）
        </AppText>
        <AppText muted className="mt-2">
          配对时长差{" "}
          {s.pairedMinutesDelta === null
            ? "—"
            : `${s.pairedMinutesDelta > 0 ? "+" : ""}${s.pairedMinutesDelta} 分钟`}{" "}
          · {s.pairedDurationCount} 节可比；额外训练记录 {s.additionalRecords}{" "}
          条
        </AppText>
        <AppText className="mt-3">
          平均 RPE {s.rpeAverage ?? "—"}/10（{s.rpeCount} 条） · 疲劳{" "}
          {s.fatigueAverage ?? "—"}/10（{s.fatigueCount} 条）
        </AppText>
      </Card>
      <Card>
        <AppText variant="card">{review.recommendation.label}</AppText>
        {review.recommendation.reasons.map((text) => (
          <AppText key={text} muted className="mt-2">
            {text}
          </AppText>
        ))}
        <AppText variant="label" className="mt-3 text-brand">
          当前最近三天反馈
        </AppText>
        {review.recentFeedback.length ? (
          review.recentFeedback.slice(0, 5).map((r) => (
            <AppText key={r.id} muted className="mt-2">
              {r.date} · RPE {r.rpe ?? "—"} · 疲劳 {r.fatigue ?? "—"}
            </AppText>
          ))
        ) : (
          <AppText muted className="mt-2">
            暂无近期反馈，不能据此判断恢复。
          </AppText>
        )}
        {review.ftp ? (
          <AppText className="mt-3">
            最新实测 FTP {review.ftp.valueWatts} W ·{" "}
            {new Date(review.ftp.measuredAt).toLocaleDateString("zh-CN", {
              timeZone: review.timezone,
            })}{" "}
            · {cycleFtpSource(review.ftp.source)}
            {review.ftp.deltaWatts === null
              ? ""
              : `\n较 ${review.ftp.previousMeasuredAt ? new Date(review.ftp.previousMeasuredAt).toLocaleDateString("zh-CN", { timeZone: review.timezone }) : "前次"} 实测 ${review.ftp.deltaWatts > 0 ? "+" : ""}${review.ftp.deltaWatts} W`}
          </AppText>
        ) : (
          <AppText muted className="mt-3">
            暂无 FTP 测量
          </AppText>
        )}
        {review.notices.map((text) => (
          <AppText key={text} variant="caption" muted className="mt-2">
            {text}
          </AppText>
        ))}
      </Card>
    </>
  );
}
