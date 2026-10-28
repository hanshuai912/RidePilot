import { Pressable, View } from "react-native";

import { AppText, Button, Card } from "../../../components/ui";
import type { CoachTask } from "../hooks/useInitialPlan";
import { AiMark, InfoStrip } from "./CoachPage";

function QuickAction({
  icon,
  label,
  description,
  onPress,
}: {
  icon: string;
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
      <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-[#303228]">
        <AppText className="text-brand">{icon}</AppText>
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
  onCalendar,
  onCurrentWeek,
  onNextWeek,
}: {
  planVersion: number;
  ready: boolean;
  missingData: string;
  onTask: (task: CoachTask) => void;
  onFeedback: () => void;
  onCalendar: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
}) {
  return (
    <>
      <View className="overflow-hidden rounded-[19px] border border-border bg-surface p-4">
        <View className="flex-row items-start justify-between">
          <AiMark />
          <View className="rounded-full border border-[#625D42] bg-[#302F24] px-3 py-1.5">
            <AppText variant="label" className="text-brand">
              正式计划 v{planVersion}
            </AppText>
          </View>
        </View>
        <AppText variant="label" className="mt-5 text-muted">
          当前训练计划
        </AppText>
        <AppText variant="display" className="mt-2 text-[27px] leading-[32px]">
          先看状态，再决定下一步
        </AppText>
        <AppText variant="body" className="mt-2 text-secondary">
          训练反馈、身体状态和比赛安排会先形成建议草稿，确认后才会改变未来课程。
        </AppText>
      </View>

      <Card>
        <View className="flex-row items-center justify-between">
          <AppText variant="label" className="text-brand">
            计划状态
          </AppText>
          <AppText variant="caption" muted>
            持续协作
          </AppText>
        </View>
        <AppText variant="card" className="mt-2">
          未来训练仍按正式计划执行
        </AppText>
        <AppText variant="caption" muted className="mt-1">
          你可以告诉 AI 教练发生了什么，再选择影响范围。已完成的训练记录会保留。
        </AppText>
        {!ready ? <InfoStrip>{missingData}</InfoStrip> : null}
      </Card>

      <View>
        <AppText variant="label" className="mb-2 text-muted">
          我想做什么？
        </AppText>
        <View className="flex-row gap-2">
          <QuickAction
            icon="↗"
            label="重新规划"
            description="调整目标或训练日期"
            onPress={() => onTask("REPLAN")}
          />
          <QuickAction
            icon="◌"
            label="赛后恢复"
            description="安排恢复周再开始"
            onPress={() => onTask("RECOVERY")}
          />
        </View>
        <View className="mt-2 flex-row gap-2">
          <QuickAction
            icon="▣"
            label="训练反馈"
            description="查看训练并告诉我结果"
            onPress={onFeedback}
          />
          <QuickAction
            icon="◆"
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
        <Button className="mt-2" variant="ghost" onPress={onCalendar}>
          查看完整训练日历
        </Button>
      </Card>
    </>
  );
}
