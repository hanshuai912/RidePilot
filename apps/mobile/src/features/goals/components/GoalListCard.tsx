import { Pressable, View } from "react-native";
import { CalendarDays, ChevronRight, Target } from "lucide-react-native";
import { AppText, Badge } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { goalTypeLabels } from "../model/goal-lifecycle";
import {
  goalDateLabel,
  goalStatusLabel,
  type GoalRecord,
} from "../model/goal-presentation";

export function GoalListCard({
  goal,
  onOpen,
}: {
  goal: GoalRecord;
  onOpen: () => void;
}) {
  const primary = goal.priority === "PRIMARY" && goal.status === "ACTIVE";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看目标：${goalTypeLabels[goal.type]}`}
      onPress={onOpen}
      className={`rounded-card border bg-surface p-5 active:bg-surface-2 ${primary ? "border-brand-subtle" : "border-border"}`}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
          <Target
            color={primary ? colors.brand : colors.textSecondary}
            size={20}
          />
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="card">{goalTypeLabels[goal.type]}</AppText>
          <AppText variant="caption" className="mt-1 text-secondary">
            {goalStatusLabel(goal)} ·{" "}
            {goal.priority === "PRIMARY" ? "主目标" : "次目标"}
          </AppText>
        </View>
        <ChevronRight color={colors.textSecondary} size={18} />
      </View>
      {goal.description && goal.description !== goalTypeLabels[goal.type] ? (
        <AppText className="mt-3 text-secondary">{goal.description}</AppText>
      ) : null}
      {goal.targetFtpWatts || goal.targetWkg ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {goal.targetFtpWatts ? (
            <Badge variant={primary ? "brand" : "neutral"}>
              目标 {goal.targetFtpWatts} W
            </Badge>
          ) : null}
          {goal.targetWkg ? (
            <Badge variant="neutral">{goal.targetWkg} W/kg</Badge>
          ) : null}
        </View>
      ) : null}
      <View className="mt-4 flex-row items-center gap-2 border-t border-divider pt-3">
        <CalendarDays color={colors.textSecondary} size={15} />
        <AppText
          variant="caption"
          className="min-w-0 flex-1 tabular-nums text-secondary"
        >
          {goalDateLabel(goal.targetDate)}
        </AppText>
      </View>
    </Pressable>
  );
}
