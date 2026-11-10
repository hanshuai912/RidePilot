import { Pressable, View } from "react-native";
import { Activity, ChevronRight, CircleAlert } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { CoachOverview } from "@ridepilot/contracts";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { goalTitle } from "../../goals/model/goal-lifecycle";
import { coachStatusSummary } from "../model/coach-home";

export function CoachContextCard({ data }: { data: CoachOverview }) {
  const router = useRouter();
  const statusColor =
    data.status.code === "STABLE"
      ? colors.positive
      : data.status.code === "INSUFFICIENT"
        ? colors.textSecondary
        : colors.warning;
  return (
    <View className="rounded-card bg-surface p-4" testID="coach-context">
      <View className="flex-row items-center justify-between gap-2">
        <AppText variant="caption" className="text-secondary">
          {data.stage?.upcoming ? "下一阶段" : "当前阶段"}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看状态依据"
          onPress={() => router.push("/(tabs)/coach/status")}
          className="min-h-11 min-w-0 shrink flex-row items-center gap-1.5 active:opacity-70"
        >
          <Activity color={statusColor} size={15} />
          <AppText
            variant="caption"
            className="shrink"
            style={{ color: statusColor }}
          >
            {coachStatusSummary[data.status.code]}
          </AppText>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="查看目标与阶段"
        onPress={() =>
          data.goal
            ? router.push({
                pathname: "/goals/[goalId]",
                params: { goalId: data.goal.id },
              })
            : router.push("/goals")
        }
        className="min-h-11 flex-row items-center justify-between gap-3 active:opacity-70"
      >
        <View className="min-w-0 flex-1">
          <AppText variant="section">
            {data.stage?.title ?? "阶段待规划"}
          </AppText>
          <AppText
            variant="caption"
            className="mt-1 text-secondary"
            numberOfLines={2}
          >
            {data.goal
              ? `目标：${goalTitle(data.goal.title)}`
              : (data.stage?.purpose ?? "先设置目标，再规划训练阶段")}
          </AppText>
        </View>
        <ChevronRight color={colors.textSecondary} size={19} />
      </Pressable>
      {data.stageNotice ? (
        <View className="mt-3 flex-row items-start gap-2">
          <CircleAlert color={colors.warning} size={15} />
          <AppText variant="caption" className="flex-1 text-warning">
            {data.stageNotice}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
