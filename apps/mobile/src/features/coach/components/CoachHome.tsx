import { Pressable, View } from "react-native";
import { CalendarDays, RefreshCw } from "lucide-react-native";
import { AppText, Button } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { CoachTask } from "../hooks/useInitialPlan";

function QuickAction({
  icon,
  label,
  description,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      className={`min-h-[132px] min-w-0 flex-1 rounded-xl bg-surface p-4 active:bg-surface-2 ${disabled ? "opacity-50" : ""}`}
      onPress={onPress}
    >
      <View className="mb-3 h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
        {icon}
      </View>
      <View>
        <AppText variant="body" className="font-medium">
          {label}
        </AppText>
      </View>
      <AppText variant="caption" className="mt-2 text-secondary">
        {description}
      </AppText>
    </Pressable>
  );
}
export function CoachHome({
  ready,
  missingData,
  busy = false,
  onTask,
  onCurrentWeek,
  onCompleteProfile,
}: {
  ready: boolean;
  missingData: string;
  busy?: boolean;
  onTask: (task: CoachTask) => void;
  onCurrentWeek: () => void;
  onCompleteProfile: () => void;
}) {
  return (
    <View className="gap-3" testID="coach-quick-tasks">
      <AppText variant="section" className="mb-1">
        训练调整
      </AppText>
      {!ready ? (
        <View className="rounded-xl bg-surface-2 px-3 py-2">
          <AppText variant="body" className="text-warning">
            待补充：{missingData}
          </AppText>
          <Button variant="ghost" disabled={busy} onPress={onCompleteProfile}>
            补全训练资料
          </Button>
        </View>
      ) : null}
      <View className="flex-row gap-3">
        <QuickAction
          icon={<RefreshCw color={colors.brand} size={18} />}
          label="调整训练"
          description="选择范围与调整原因"
          onPress={() => onTask("REPLAN")}
          disabled={busy}
        />
        <QuickAction
          icon={<CalendarDays color={colors.brand} size={18} />}
          label="调整本周"
          description="快速生成本周草稿"
          onPress={onCurrentWeek}
          disabled={busy}
        />
      </View>
    </View>
  );
}
