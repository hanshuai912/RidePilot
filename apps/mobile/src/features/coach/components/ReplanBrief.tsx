import { Pressable, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { AppText, Input } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { PlanningScope } from "../services/adjustment-scope";
import type { CoachPlanStatus } from "../services/coach.api";

const scopes: { value: PlanningScope; label: string; note: string }[] = [
  { value: "NEXT_WORKOUT", label: "下一节训练", note: "只调整最近一节课程" },
  { value: "THIS_WEEK", label: "本周剩余训练", note: "调整本周尚未完成的安排" },
  { value: "NEXT_WEEK", label: "从下周开始", note: "重新安排下一周的训练" },
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
}: {
  planningScope: PlanningScope;
  setPlanningScope: (value: PlanningScope) => void;
  taskNote: string;
  setTaskNote: (value: string) => void;
  planStatus: CoachPlanStatus;
  goalLabel: string;
  goalDate: string;
  onEditGoal: () => void;
}) {
  return (
    <View className="gap-6" testID="coach-replan-brief">
      <View>
        <AppText variant="title">让训练适应最近的变化</AppText>
        <AppText className="mt-2 text-secondary">
          时间、精力或训练重点有变化时，先选范围，再告诉教练你的想法。
        </AppText>
      </View>
      <View>
        <AppText variant="section" className="mb-3">
          调整哪些训练
        </AppText>
        <View className="gap-2">
          {scopes.map(({ value, label, note }) => {
            const selected = value === planningScope;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => setPlanningScope(value)}
                className={`min-h-[76px] flex-row items-center gap-3 rounded-xl border p-4 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"}`}
              >
                <View className="min-w-0 flex-1 gap-1">
                  <AppText className="font-medium">{label}</AppText>
                  <AppText variant="caption" className="text-secondary">
                    {note}
                  </AppText>
                </View>
                <View
                  className={`h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-brand bg-brand" : "border-border"}`}
                >
                  {selected ? <Check size={15} color={colors.brandOn} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View>
        <View className="mb-3 flex-row items-center justify-between">
          <AppText variant="section">有哪些变化</AppText>
          <AppText variant="caption" className="text-secondary">
            选填
          </AppText>
        </View>
        <Input
          accessibilityLabel="训练调整说明"
          value={taskNote}
          onChangeText={setTaskNote}
          multiline
          textAlignVertical="top"
          maxLength={240}
          className="min-h-[120px] py-4"
          placeholder="例如：这周工作比较忙，每次只能练 40 分钟，希望保留耐力训练。"
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="修改当前目标与日期"
        onPress={onEditGoal}
        className="min-h-[76px] flex-row items-center gap-3 rounded-xl bg-surface p-4 active:bg-surface-2"
      >
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="caption" className="text-secondary">
            围绕当前目标
          </AppText>
          <AppText>
            {goalLabel} · {goalDate}
          </AppText>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} />
      </Pressable>
      <AppText variant="caption" className="text-secondary">
        基于正式计划 v{planStatus.planVersion}{" "}
        生成草稿，预览确认后生效。已完成的训练会保留。
      </AppText>
    </View>
  );
}
