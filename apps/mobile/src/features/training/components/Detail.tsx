import { View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import type { Workout } from "../model/training";
import { dateLabel, iso } from "../model/training";
import { WorkoutSegmentList, segmentTotals } from "./WorkoutSegmentList";
import { Total } from "./TrainingParts";
import { styles } from "./training.styles";

export function Detail({
  workout,
  onEdit,
  onAdjust,
  onFeedback,
  feedbackSaved,
}: {
  workout: Workout;
  onEdit: () => void;
  onAdjust: () => void;
  onFeedback: () => void;
  feedbackSaved: boolean;
}) {
  const totals = segmentTotals(workout.segments);
  const canAdjust = workout.scheduledDate >= iso(new Date());
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
      </Card>
      <View style={styles.sectionRow}>
        <AppText variant="card">动作列表</AppText>
        <AppText variant="caption" muted>
          {workout.segments.length} 个动作
        </AppText>
      </View>
      <WorkoutSegmentList segments={workout.segments} />
      <Button onPress={onFeedback} variant="secondary">
        {feedbackSaved ? "已记录训练反馈" : "记录训练反馈"}
      </Button>
      <Button onPress={onAdjust} className="mt-2" disabled={!canAdjust}>
        {canAdjust ? "让 AI 调整这节课" : "历史课程不可调整"}
      </Button>
      <Button onPress={onEdit} variant="ghost" className="mt-2">
        编辑动作
      </Button>
    </View>
  );
}
