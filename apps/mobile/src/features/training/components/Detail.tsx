import { View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import type { Workout } from "../model/training";
import { dateLabel } from "../model/training";
import { WorkoutSegmentList, segmentTotals } from "./WorkoutSegmentList";
import { Total } from "./TrainingParts";
import { styles } from "./training.styles";

export function Detail({
  workout,
  onEdit,
}: {
  workout: Workout;
  onEdit: () => void;
}) {
  const totals = segmentTotals(workout.segments);
  return (
    <View style={styles.page}>
      <AppText variant="caption" muted>
        {dateLabel(workout.scheduledDate)} · 第 {workout.dayOrder} 节 · 手动创建
      </AppText>
      <Card style={styles.card}>
        <AppText variant="label" style={styles.positive}>
          ● 手动创建 · 正式计划
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
      <Button onPress={onEdit}>编辑动作</Button>
    </View>
  );
}
