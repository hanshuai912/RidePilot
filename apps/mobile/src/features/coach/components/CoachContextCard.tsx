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
    <View testID="coach-context">
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
        className="min-h-11 flex-row items-center justify-between gap-4 active:opacity-70"
      >
        <View className="min-w-0 flex-1">
          <View className="mb-2 flex-row items-center gap-2">
            <View className="h-1 w-4 rounded-full bg-brand" />
            <AppText variant="caption" className="text-secondary">
              {data.stage?.upcoming ? "下一阶段" : "当前阶段"}
            </AppText>
          </View>
          <AppText variant="title">{data.stage?.title ?? "阶段待规划"}</AppText>
          <AppText variant="body" className="mt-2 text-secondary">
            {data.goal
              ? `目标：${goalTitle(data.goal.title)}`
              : (data.stage?.purpose ?? "先设置目标，再规划训练阶段")}
          </AppText>
        </View>
        <ChevronRight color={colors.textSecondary} size={19} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="查看状态依据"
        onPress={() => router.push("/(tabs)/coach/status")}
        className="mt-4 min-h-11 flex-row items-center gap-2 rounded-xl bg-surface px-3 py-2 active:bg-surface-2"
      >
        <Activity color={statusColor} size={16} />
        <AppText
          variant="caption"
          className="min-w-0 flex-1"
          style={{ color: statusColor }}
        >
          {coachStatusSummary[data.status.code]}
        </AppText>
        <ChevronRight color={statusColor} size={16} />
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
