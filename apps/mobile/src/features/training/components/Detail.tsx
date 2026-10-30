import { View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import type { Workout } from "../model/training";
import { dateLabel } from "../model/training";
import { WorkoutSegmentList, segmentTotals } from "./WorkoutSegmentList";
import { WorkoutProfileChart } from "./WorkoutProfileChart";
import { Total } from "./TrainingParts";
import { styles } from "./training.styles";

export function Detail({
  workout,
  onEdit,
  onAdjust,
  onFeedback,
  feedbackSaved,
  busy = false,
}: {
  workout: Workout;
  onEdit: () => void;
  onAdjust: () => void;
  onFeedback: () => void;
  feedbackSaved: boolean;
  busy?: boolean;
}) {
  const totals = segmentTotals(workout.segments);
  const recorded = !!workout.activity || feedbackSaved;
  const canAdjust = workout.editable !== false && !recorded;
  return (
    <View style={styles.page}>
      <AppText variant="caption" muted>
        {dateLabel(workout.scheduledDate)} · 第 {workout.dayOrder} 节 ·
        {workout.source === "ai" ? " AI 教练" : " 手动创建"}
      </AppText>
      <Card style={styles.card}>
        <AppText variant="label" style={styles.positive}>
          ● {workout.source === "ai" ? "AI 教练" : "手动创建"} · 正式计划
        </AppText>
        <AppText variant="section">{workout.title || "骑行训练"}</AppText>
        <AppText variant="caption" muted>
          {workout.purpose || "按每个动作的强度范围执行。"}
        </AppText>
        <View style={styles.totalGrid}>
          <Total
            label="时间目标"
            value={totals.minutes ? `${totals.minutes} 分钟` : "—"}
          />
          <Total
            label="距离目标"
            value={totals.kilometers ? `${totals.kilometers} 公里` : "—"}
          />
        </View>
        <WorkoutProfileChart segments={workout.segments} />
      </Card>
      <View style={styles.sectionRow}>
        <AppText variant="card">动作列表</AppText>
        <AppText variant="caption" muted>
          {workout.segments.length} 个动作
        </AppText>
      </View>
      <WorkoutSegmentList segments={workout.segments} />
      {workout.activity ? (
        <Card>
          <AppText variant="card">
            {
              { COMPLETED: "已完成", PARTIAL: "部分完成", SKIPPED: "已跳过" }[
                workout.activity.status
              ]
            }
          </AppText>
          <AppText variant="caption" muted>
            {[
              workout.activity.durationMin !== null
                ? `实际 ${workout.activity.durationMin} 分钟`
                : null,
              workout.activity.rpe !== null
                ? `RPE ${workout.activity.rpe}`
                : null,
              workout.activity.fatigue !== null
                ? `疲劳 ${workout.activity.fatigue}`
                : null,
              workout.activity.notes,
            ]
              .filter(Boolean)
              .join(" · ") || "已保存实际训练记录"}
          </AppText>
        </Card>
      ) : null}
      <Button
        onPress={onFeedback}
        variant="secondary"
        disabled={recorded || busy}
      >
        {recorded ? "已记录训练反馈" : "记录训练反馈"}
      </Button>
      <Button onPress={onAdjust} className="mt-2" disabled={!canAdjust || busy}>
        {canAdjust
          ? "让 AI 调整这节课"
          : recorded
            ? "已记录课程不可调整"
            : "历史课程不可调整"}
      </Button>
      <Button
        onPress={onEdit}
        variant="ghost"
        className="mt-2"
        disabled={!canAdjust || busy}
      >
        编辑动作
      </Button>
    </View>
  );
}
