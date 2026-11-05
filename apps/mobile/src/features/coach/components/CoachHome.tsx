import { Pressable, View } from "react-native";
import {
  ClipboardCheck,
  Flag,
  RefreshCw,
  RotateCcw,
} from "lucide-react-native";

import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { CoachTask } from "../hooks/useInitialPlan";
import { InfoStrip } from "./CoachPage";

function QuickAction({
  icon,
  label,
  description,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-[112px] flex-1 rounded-[16px] border border-border bg-surface-2 p-3"
      onPress={onPress}
    >
      <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-brand-subtle">
        {icon}
      </View>
      <AppText variant="card" className="mt-3 text-[15px]">
        {label}
      </AppText>
      <AppText variant="caption" muted className="mt-1">
        {description}
      </AppText>
    </Pressable>
  );
}

export function CoachHome({
  planVersion,
  ready,
  missingData,
  onTask,
  onFeedback,
  onCurrentWeek,
  onNextWeek,
}: {
  planVersion: number;
  ready: boolean;
  missingData: string;
  onTask: (task: CoachTask) => void;
  onFeedback: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
}) {
  return (
    <>
      <Card>
        <AppText variant="label" className="text-brand">
          正式计划 v{planVersion} · 快捷任务
        </AppText>
        <AppText muted className="mt-2">
          选择需要改变的安排，预览并确认后才会应用。
        </AppText>
        {!ready ? <InfoStrip>{missingData}</InfoStrip> : null}
      </Card>

      <View>
        <AppText variant="label" className="mb-2 text-muted">
          我想做什么？
        </AppText>
        <View className="flex-row gap-2">
          <QuickAction
            icon={
              <RefreshCw color={colors.brand} size={17} strokeWidth={1.8} />
            }
            label="重新规划"
            description="调整目标或训练日期"
            onPress={() => onTask("REPLAN")}
          />
          <QuickAction
            icon={
              <RotateCcw color={colors.brand} size={17} strokeWidth={1.8} />
            }
            label="赛后恢复"
            description="安排恢复周再开始"
            onPress={() => onTask("RECOVERY")}
          />
        </View>
        <View className="mt-2 flex-row gap-2">
          <QuickAction
            icon={
              <ClipboardCheck
                color={colors.brand}
                size={17}
                strokeWidth={1.8}
              />
            }
            label="训练反馈"
            description="查看训练并告诉我结果"
            onPress={onFeedback}
          />
          <QuickAction
            icon={<Flag color={colors.brand} size={17} strokeWidth={1.8} />}
            label="准备比赛"
            description="加入比赛日期与目标"
            onPress={() => onTask("RACE")}
          />
        </View>
      </View>

      <Card>
        <View className="flex-row items-center justify-between">
          <View>
            <AppText variant="label" className="text-muted">
              训练日历
            </AppText>
            <AppText variant="card" className="mt-2">
              从最近一周开始调整
            </AppText>
          </View>
          <AppText className="text-brand">→</AppText>
        </View>
        <AppText variant="caption" muted className="mt-1">
          选择影响范围后，AI 会把变化整理成一份可预览的草稿。
        </AppText>
        <View className="mt-4 flex-row gap-2">
          <Button
            className="flex-1"
            variant="secondary"
            onPress={onCurrentWeek}
          >
            调整本周
          </Button>
          <Button className="flex-1" variant="secondary" onPress={onNextWeek}>
            规划下周
          </Button>
        </View>
      </Card>
    </>
  );
}
