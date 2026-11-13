import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { AppText, Input } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { CoachPlanStatus } from "../services/coach.api";
import type { PlanningScope } from "../services/adjustment-scope";

type BodyStatus = "READY" | "TIRED" | "RECOVERY";

const bodyOptions: { value: BodyStatus; label: string; note: string }[] = [
  { value: "READY", label: "感觉正常", note: "没有明显疲劳或酸痛" },
  { value: "TIRED", label: "仍有疲劳", note: "希望降低近期训练压力" },
  {
    value: "RECOVERY",
    label: "需要充分恢复",
    note: "希望先休息或安排轻松骑行",
  },
];
const scopes: { value: PlanningScope; label: string; note: string }[] = [
  {
    value: "NEXT_WORKOUT",
    label: "下一节",
    note: "只调整最近一节尚未完成的训练。",
  },
  {
    value: "THIS_WEEK",
    label: "本周剩余",
    note: "调整本周尚未完成的训练安排。",
  },
  {
    value: "NEXT_WEEK",
    label: "下周",
    note: "调整下一周的训练，本周安排保持不变。",
  },
];

export function RecoveryBrief({
  planningScope,
  setPlanningScope,
  taskNote,
  setTaskNote,
  bodyStatus,
  setBodyStatus,
  planStatus,
  goalLabel,
  busy = false,
}: {
  planningScope: PlanningScope;
  setPlanningScope: (value: PlanningScope) => void;
  taskNote: string;
  setTaskNote: (value: string) => void;
  bodyStatus: BodyStatus;
  setBodyStatus: (value: BodyStatus) => void;
  planStatus: CoachPlanStatus;
  goalLabel: string;
  busy?: boolean;
}) {
  return (
    <View className="gap-6" testID="coach-recovery-brief">
      <View>
        <AppText variant="title">根据赛后感受调整训练</AppText>
        <AppText className="mt-2 text-secondary">
          选择当前感受和调整范围，再补充比赛情况。
        </AppText>
      </View>

      <View testID="recovery-body-section">
        <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
          <AppText variant="section">现在感觉如何</AppText>
          <AppText variant="caption" className="text-secondary">
            按自身感受选择
          </AppText>
        </View>
        <View className="gap-2">
          {bodyOptions.map(({ value, label, note }) => {
            const selected = value === bodyStatus;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected, disabled: busy }}
                aria-checked={selected}
                disabled={busy}
                onPress={() => setBodyStatus(value)}
                className={`min-h-[76px] flex-row items-center gap-3 rounded-xl border p-4 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${busy ? "opacity-50" : "active:opacity-70"}`}
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

      <View testID="recovery-scope-section">
        <AppText variant="section" className="mb-3">
          调整哪些训练
        </AppText>
        <View className="flex-row flex-wrap gap-2">
          {scopes.map(({ value, label }) => {
            const selected = value === planningScope;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected, disabled: busy }}
                aria-checked={selected}
                disabled={busy}
                onPress={() => setPlanningScope(value)}
                className={`min-h-12 min-w-[80px] flex-1 items-center justify-center rounded-xl border px-2 py-3 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${busy ? "opacity-50" : "active:opacity-70"}`}
              >
                <AppText
                  className={
                    selected ? "font-medium text-brand" : "text-secondary"
                  }
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" className="mt-3 text-secondary">
          {scopes.find(({ value }) => value === planningScope)?.note}
        </AppText>
      </View>

      <View testID="recovery-note-section">
        <View className="mb-3 flex-row items-center justify-between">
          <AppText variant="section">比赛与恢复情况</AppText>
          <AppText variant="caption" className="text-secondary">
            选填
          </AppText>
        </View>
        <Input
          accessibilityLabel="比赛与恢复情况"
          value={taskNote}
          onChangeText={setTaskNote}
          editable={!busy}
          multiline
          textAlignVertical="top"
          maxLength={240}
          className="py-4"
          style={{ minHeight: 112 }}
          placeholder="例如：周日完成 100 公里公路赛，骑了 4 小时，目前双腿酸胀，希望先轻松骑行。"
        />
        <AppText variant="caption" className="mt-2 text-right text-secondary">
          {taskNote.length}/240
        </AppText>
      </View>

      <View className="gap-3 border-t border-divider pt-4">
        <View className="flex-row items-start gap-3">
          <AppText variant="caption" className="pt-1 text-secondary">
            当前目标
          </AppText>
          <View className="min-w-0 flex-1 gap-1">
            <AppText>{goalLabel}</AppText>
          </View>
        </View>
        <AppText variant="caption" className="text-secondary">
          基于正式计划 v{planStatus.planVersion}{" "}
          生成草稿，预览确认后生效。已完成的训练会保留。
        </AppText>
      </View>
    </View>
  );
}
