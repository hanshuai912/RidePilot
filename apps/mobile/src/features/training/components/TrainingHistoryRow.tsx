import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { AppText, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { Workout } from "../model/training";

export function TrainingHistoryRow({
  workout,
  onPress,
}: {
  workout: Workout;
  onPress: () => void;
}) {
  const status = workout.activity
    ? { COMPLETED: "已完成", PARTIAL: "部分完成", SKIPPED: "已跳过" }[
        workout.activity.status
      ]
    : "未记录";
  const duration =
    workout.activity?.durationMin != null
      ? `实际 ${workout.activity.durationMin} 分钟`
      : workout.timeTargetMinutes != null
        ? `计划 ${workout.timeTargetMinutes} 分钟`
        : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.scheduledDate} ${workout.title || "骑行训练"}`}
      accessibilityHint="查看该次训练详情"
      onPress={onPress}
    >
      <Card className="flex-row items-center gap-3 p-4">
        <View className="flex-1 gap-2">
          <AppText variant="caption" className="text-brand">
            {workout.scheduledDate} · 第 {workout.dayOrder} 节
          </AppText>
          <AppText variant="card">{workout.title || "骑行训练"}</AppText>
          <AppText variant="caption" muted>
            {[status, duration].filter(Boolean).join(" · ")}
          </AppText>
        </View>
        <ChevronRight color={colors.textMuted} size={18} />
      </Card>
    </Pressable>
  );
}
