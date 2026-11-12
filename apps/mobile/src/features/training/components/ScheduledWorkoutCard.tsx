import { Pressable, View } from "react-native";
import { Bike, ChevronRight } from "lucide-react-native";
import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/tokens";
import type { Workout } from "../model/training";
import { styles } from "./training.styles";
import { WorkoutProfileChart } from "./WorkoutProfileChart";
import { styles as homeStyles } from "./training-home.styles";

export function ScheduledWorkoutCard({
  item,
  today,
  onDetail,
  onAdjust,
  onEdit,
}: {
  item: Workout;
  today: string;
  onDetail: () => void;
  onAdjust: () => void;
  onEdit: () => void;
}) {
  const editable =
    item.scheduledDate >= today && item.editable !== false && !item.activity;
  return (
    <Card style={homeStyles.courseCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看${item.title || "骑行训练"}详情`}
        accessibilityHint="打开课程详情"
        onPress={onDetail}
        style={homeStyles.courseContent}
      >
        <View style={styles.workoutTop}>
          <View style={styles.source}>
            <Bike size={14} color={colors.positive} />
            <AppText variant="label" style={styles.positive}>
              {item.source === "ai" ? "AI 教练 · 正式" : "手动创建 · 正式"}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            第 {item.dayOrder} 节
          </AppText>
        </View>
        <View style={homeStyles.courseTitle}>
          <AppText variant="card" style={{ flex: 1 }}>
            {item.title || "骑行训练"}
          </AppText>
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
        <AppText variant="caption" muted>
          {item.purpose || "结构化骑行课程"}
        </AppText>
        <View style={styles.chips}>
          <AppText variant="label" style={styles.chip}>
            {item.timeTargetMinutes
              ? `${item.timeTargetMinutes} 分钟`
              : "无时间目标"}
          </AppText>
          {item.distanceTargetKm ? (
            <AppText variant="label" style={styles.chip}>
              {item.distanceTargetKm} 公里
            </AppText>
          ) : null}
          <AppText variant="label" style={styles.chip}>
            {item.segments.length} 个动作
          </AppText>
        </View>
        <WorkoutProfileChart segments={item.segments} />
      </Pressable>
      {editable ? (
        <View
          testID={`workout-primary-actions-${item.id}`}
          style={homeStyles.courseActions}
        >
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onPress={onAdjust}
          >
            {item.scheduledDate === today ? "调整今天" : "AI 调整"}
          </Button>
          <Button variant="ghost" size="lg" className="flex-1" onPress={onEdit}>
            编辑动作
          </Button>
        </View>
      ) : null}
    </Card>
  );
}
