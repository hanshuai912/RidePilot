import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { PlanningScope } from "../services/adjustment-scope";
import type { CoachPlanStatus } from "../services/coach.api";
import { ReplanNote } from "./ReplanNote";

const scopes: {
  value: PlanningScope;
  label: string;
  shortLabel: string;
  note: string;
}[] = [
  {
    value: "NEXT_WORKOUT",
    label: "下一节训练",
    shortLabel: "下一节",
    note: "只调整最近一节尚未完成的训练，其他课程保留。",
  },
  {
    value: "THIS_WEEK",
    label: "本周剩余训练",
    shortLabel: "本周剩余",
    note: "调整本周尚未完成的训练，已完成记录保留。",
  },
  {
    value: "NEXT_WEEK",
    label: "从下周开始",
    shortLabel: "下周",
    note: "重新安排下一周的训练，本周安排保持不变。",
  },
];

export function ReplanBrief({
  planningScope,
  setPlanningScope,
  taskNote,
  setTaskNote,
  planStatus,
  goalLabel,
  goalDate,
  onEditGoal,
  busy = false,
}: {
  planningScope: PlanningScope;
  setPlanningScope: (value: PlanningScope) => void;
  taskNote: string;
  setTaskNote: (value: string) => void;
  planStatus: CoachPlanStatus;
  goalLabel: string;
  goalDate: string;
  onEditGoal: () => void;
  busy?: boolean;
}) {
  return (
    <View className="gap-6" testID="coach-replan-brief">
      <View>
        <AppText variant="title">调整接下来的训练</AppText>
        <AppText className="mt-2 text-secondary">
          选好范围，再补充时间、强度或训练环境的变化。
        </AppText>
      </View>
      <View testID="replan-scope-section">
        <AppText variant="section" className="mb-3">
          调整哪些训练
        </AppText>
        <View className="flex-row flex-wrap gap-2">
          {scopes.map(({ value, label, shortLabel }) => {
            const selected = value === planningScope;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected, disabled: busy }}
                disabled={busy}
                aria-checked={selected}
                onPress={() => setPlanningScope(value)}
                className={`min-h-12 min-w-[80px] flex-1 items-center justify-center rounded-xl border px-2 py-3 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${busy ? "opacity-50" : "active:opacity-70"}`}
              >
                <AppText
                  className={
                    selected ? "font-medium text-brand" : "text-secondary"
                  }
                >
                  {shortLabel}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" className="mt-3 text-secondary">
          {scopes.find(({ value }) => value === planningScope)?.note}
        </AppText>
      </View>
      <ReplanNote value={taskNote} onChange={setTaskNote} disabled={busy} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="修改当前目标与日期"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onEditGoal}
        testID="replan-goal-context"
        className={`min-h-[76px] flex-row items-center gap-3 rounded-xl border border-border bg-surface p-4 ${busy ? "opacity-50" : "active:bg-surface-2"}`}
      >
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="caption" className="text-secondary">
            当前目标
          </AppText>
          <AppText variant="card">{goalLabel}</AppText>
          <AppText variant="caption" className="text-secondary">
            {goalDate}
          </AppText>
        </View>
        <AppText variant="caption" className="text-brand">
          修改
        </AppText>
        <ChevronRight size={18} color={colors.textSecondary} />
      </Pressable>
      <AppText variant="caption" className="text-secondary">
        基于正式计划 v{planStatus.planVersion}{" "}
        生成草稿，预览确认后生效。已完成的训练会保留。
      </AppText>
    </View>
  );
}
