import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react-native";
import { useRouter } from "expo-router";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function CoachMoreActions({
  busy,
  onRecovery,
  onNextWeek,
}: {
  busy: boolean;
  onRecovery: () => void;
  onNextWeek: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const actions = [
    { title: "赛后恢复", run: onRecovery },
    { title: "规划下周", run: onNextWeek },
    {
      title: "训练执行与周期复盘",
      run: () => router.push("/(tabs)/coach/cycle-review"),
    },
    { title: "目标阶段与按范围生成课程", run: () => router.push("/goals") },
    { title: "赛事管理与新增比赛", run: () => router.push("/races") },
    { title: "最近计划版本", run: () => router.push("/(tabs)/coach/status") },
    {
      title: "全部建议与历史",
      run: () => router.push("/(tabs)/coach/suggestions"),
    },
  ];
  return (
    <View
      className="rounded-card border border-border bg-surface px-4"
      testID="coach-more-actions"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="更多操作"
        accessibilityState={{ expanded, disabled: busy }}
        disabled={busy}
        onPress={() => setExpanded((value) => !value)}
        className="min-h-[52px] flex-row items-center justify-between py-3 active:opacity-70"
      >
        <AppText variant="body" className="text-secondary">
          更多操作
        </AppText>
        {expanded ? (
          <ChevronUp color={colors.textSecondary} size={16} />
        ) : (
          <ChevronDown color={colors.textSecondary} size={16} />
        )}
      </Pressable>
      {expanded ? (
        <View className="mb-4 rounded-xl bg-surface-2">
          {actions.map((action) => (
            <Pressable
              key={action.title}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={action.run}
              className="min-h-12 flex-row items-center gap-3 px-3 py-2 active:bg-surface-2"
            >
              <AppText variant="body" className="flex-1">
                {action.title}
              </AppText>
              <ChevronRight color={colors.textSecondary} size={16} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
