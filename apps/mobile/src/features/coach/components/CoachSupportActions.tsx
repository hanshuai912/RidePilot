import { Pressable, View } from "react-native";
import { ChevronRight, Flag, History, HeartPulse } from "lucide-react-native";
import { useRouter } from "expo-router";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function CoachSupportActions({
  busy,
  onRecovery,
}: {
  busy: boolean;
  onRecovery: () => void;
}) {
  const router = useRouter();
  const actions = [
    {
      label: "赛事备赛",
      description: "选择赛事，制定专属备赛计划",
      icon: Flag,
      run: () => router.push("/(tabs)/coach/races"),
    },
    {
      label: "赛后恢复",
      description: "恢复状态与训练衔接",
      icon: HeartPulse,
      run: onRecovery,
    },
    {
      label: "全部建议与历史",
      description: "查看草稿与过往记录",
      icon: History,
      run: () => router.push("/(tabs)/coach/suggestions"),
    },
  ];
  return (
    <View
      testID="coach-support-actions"
      className="overflow-hidden rounded-card border border-border bg-surface"
    >
      {actions.map(({ label, description, icon: Icon, run }, index) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={description}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={run}
          className={`min-h-[80px] flex-row items-center gap-3 px-4 py-4 active:bg-surface-2 ${index ? "border-t border-divider" : ""} ${busy ? "opacity-50" : ""}`}
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
            <Icon color={colors.textSecondary} size={20} strokeWidth={1.6} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="body" className="font-medium">
              {label}
            </AppText>
            <AppText variant="caption" className="text-secondary">
              {description}
            </AppText>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
      ))}
    </View>
  );
}
