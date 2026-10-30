import { View } from "react-native";
import type { AiProposalResponse } from "@ridepilot/contracts";

import { AppText, Card } from "../../../components/ui";

function segmentLabel(
  segment: AiProposalResponse["workouts"][number]["segments"][number],
  ftpWatts: number | null,
) {
  const type = {
    warmup: "热身",
    work: "训练",
    recovery: "恢复",
    cooldown: "放松",
  }[segment.type];
  const target = `${segment.target.value} ${segment.target.unit === "min" ? "分钟" : "公里"}`;
  const intensity =
    segment.intensity.kind === "ftp_percent"
      ? `${segment.intensity.min}–${segment.intensity.max}% FTP${ftpWatts ? `（约 ${Math.round((ftpWatts * segment.intensity.min) / 100)}–${Math.round((ftpWatts * segment.intensity.max) / 100)} W）` : ""}`
      : `${segment.intensity.min}–${segment.intensity.max} W`;
  return `${type} · ${target} · ${intensity}${segment.repeatCount && segment.repeatCount > 1 ? ` × ${segment.repeatCount}` : ""}`;
}

export function PlanPreview({
  proposal,
  ftpWatts,
  nutritionSummary = "无特殊限制",
}: {
  proposal: AiProposalResponse;
  ftpWatts: number | null;
  nutritionSummary?: string;
}) {
  const totalMinutes = proposal.workouts.reduce(
    (total, workout) =>
      total +
      workout.segments.reduce(
        (segmentTotal, segment) =>
          segmentTotal +
          (segment.target.unit === "min"
            ? segment.target.value * (segment.repeatCount ?? 1)
            : 0),
        0,
      ),
    0,
  );

  return (
    <>
      <View className="rounded-[18px] border border-border border-l-4 border-l-brand bg-surface p-4">
        <AppText variant="label" className="text-brand">
          AI 训练草稿 · 尚未应用
        </AppText>
        <AppText variant="section" className="mt-2">
          {proposal.summary}
        </AppText>
        <AppText variant="caption" className="mt-3 text-secondary">
          {proposal.scene === "WORKOUT_ADJUST"
            ? "仅调整选中的一节训练"
            : `训练周从 ${proposal.weekStartDate} 开始`}{" "}
          · 日期：
          {[
            ...new Set(
              proposal.workouts.map((workout) => workout.scheduledDate),
            ),
          ]
            .sort()
            .join("、")}
        </AppText>
        <View className="mt-4 flex-row gap-2">
          <View className="flex-1 rounded-xl bg-surface-2 p-3">
            <AppText variant="label" muted>
              课程数
            </AppText>
            <AppText variant="card" className="mt-1 text-brand">
              {proposal.workouts.length}
            </AppText>
          </View>
          <View className="flex-1 rounded-xl bg-surface-2 p-3">
            <AppText variant="label" muted>
              训练时间
            </AppText>
            <AppText variant="card" className="mt-1 text-brand">
              {totalMinutes || "—"} {totalMinutes ? "分钟" : ""}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" muted className="mt-3">
          {proposal.basePlanVersion === 0
            ? "首次应用：无正式计划 → 正式计划 v1"
            : `应用后：正式计划 v${proposal.basePlanVersion} → v${proposal.basePlanVersion + 1}`}
          {proposal.replaceWorkoutIds.length
            ? ` · 将替换 ${proposal.replaceWorkoutIds.length} 节未来课程`
            : " · 保留已有课程"}
        </AppText>
      </View>
      <View className="rounded-[16px] border border-border bg-surface p-4">
        <View className="flex-row items-center justify-between">
          <AppText variant="card">计划变化</AppText>
          <AppText variant="label" muted>
            本次调整范围
          </AppText>
        </View>
        <View className="mt-3 rounded-xl bg-surface-2 px-3">
          <View className="flex-row justify-between border-b border-divider py-3">
            <AppText variant="caption" muted>
              训练安排
            </AppText>
            <AppText variant="caption">
              {proposal.basePlanVersion === 0
                ? "无正式计划"
                : `正式 v${proposal.basePlanVersion}`}{" "}
              → {proposal.workouts.length} 节课程
            </AppText>
          </View>
          <View className="flex-row justify-between border-b border-divider py-3">
            <AppText variant="caption" muted>
              阶段检查
            </AppText>
            <AppText variant="caption" className="max-w-[62%] text-right">
              {proposal.assessmentSuggestion}
            </AppText>
          </View>
          <View className="flex-row justify-between py-3">
            <AppText variant="caption" muted>
              饮食限制
            </AppText>
            <AppText variant="caption" className="text-right text-secondary">
              {nutritionSummary} · 暂不提交
            </AppText>
          </View>
        </View>
      </View>
      <View className="rounded-[14px] border border-positive/40 bg-surface-2 p-3">
        <AppText variant="label" className="text-positive">
          计划说明
        </AppText>
        <AppText variant="card" className="mt-2">
          阶段方向
        </AppText>
        <AppText variant="caption" className="mt-1 text-secondary">
          {proposal.stageSummary}
        </AppText>
        <AppText variant="card" className="mt-4">
          复评建议
        </AppText>
        <AppText variant="caption" className="mt-1 text-secondary">
          {proposal.assessmentSuggestion}
        </AppText>
        <AppText variant="caption" muted className="mt-3">
          阶段与复评目前是建议说明，尚未建立独立阶段或测试事件。
        </AppText>
      </View>
      <View className="gap-3">
        {proposal.workouts.map((workout, index) => (
          <View
            key={`${workout.scheduledDate}-${index}`}
            className="rounded-[16px] border border-border bg-surface p-4"
          >
            <View className="flex-row items-center justify-between gap-2">
              <AppText variant="label" className="text-brand">
                {workout.scheduledDate}
              </AppText>
              <AppText variant="label" muted>
                {workout.segments.length} 个动作
              </AppText>
            </View>
            <AppText variant="card" className="mt-2">
              {workout.title}
            </AppText>
            <AppText variant="caption" muted className="mt-1">
              {workout.purpose}
            </AppText>
            <View className="mt-3 gap-2 border-t border-divider pt-3">
              {workout.segments.map((segment, segmentIndex) => (
                <View
                  key={segment.id ?? segmentIndex}
                  className="flex-row items-start gap-2"
                >
                  <AppText variant="label" className="text-brand">
                    {segmentIndex + 1}
                  </AppText>
                  <AppText variant="caption" className="flex-1 text-secondary">
                    {segmentLabel(segment, ftpWatts)}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
      {proposal.warnings.length ? (
        <Card>
          <AppText variant="card" className="text-warning">
            需要留意
          </AppText>
          {proposal.warnings.map((warning, index) => (
            <AppText key={index} className="mt-2 text-secondary">
              {warning}
            </AppText>
          ))}
        </Card>
      ) : null}
      {proposal.blockers.length ? (
        <Card>
          <AppText variant="card" className="text-negative">
            当前无法应用
          </AppText>
          {proposal.blockers.map((blocker, index) => (
            <AppText key={index} className="mt-2 text-secondary">
              {blocker}
            </AppText>
          ))}
        </Card>
      ) : null}
    </>
  );
}
