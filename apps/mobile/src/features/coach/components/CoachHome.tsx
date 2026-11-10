import { Pressable, View } from "react-native";
import {
  CalendarDays,
  ClipboardCheck,
  Flag,
  RefreshCw,
} from "lucide-react-native";
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
      className={`min-h-[76px] min-w-0 flex-1 rounded-card border border-border bg-surface p-4 active:bg-surface-2 ${disabled ? "opacity-50" : ""}`}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-2">
        {icon}
        <AppText variant="card" className="min-w-0 flex-1">
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
  onFeedback,
  onCurrentWeek,
  onCompleteProfile,
}: {
  ready: boolean;
  missingData: string;
  busy?: boolean;
  onTask: (task: CoachTask) => void;
  onFeedback: () => void;
  onCurrentWeek: () => void;
  onCompleteProfile: () => void;
}) {
  return (
    <View className="gap-3" testID="coach-quick-tasks">
      <AppText variant="section" className="mb-1">
        AI 快捷调整
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
          label="重新规划"
          description="目标、时间有变化"
          onPress={() => onTask("REPLAN")}
          disabled={busy}
        />
        <QuickAction
          icon={<CalendarDays color={colors.brand} size={18} />}
          label="调整本周"
          description="修改近期训练安排"
          onPress={onCurrentWeek}
          disabled={busy}
        />
      </View>
      <View className="flex-row gap-3">
        <QuickAction
          icon={<ClipboardCheck color={colors.brand} size={18} />}
          label="训练反馈"
          description="完成情况与疲劳"
          onPress={onFeedback}
          disabled={busy}
        />
        <QuickAction
          icon={<Flag color={colors.brand} size={18} />}
          label="比赛安排"
          description="围绕赛事调整备赛"
          onPress={() => onTask("RACE")}
          disabled={busy}
        />
      </View>
    </View>
  );
}
