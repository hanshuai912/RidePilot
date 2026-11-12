import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { AppText, Button, Input, Dialog } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { AdjustmentReason as Reason } from "../hooks/useWorkoutAdjustment";
import type {
  WorkoutAdjustmentFormState,
  SubmitWorkoutAdjustment,
} from "../hooks/useWorkoutAdjustmentForm";
import { WorkoutAdjustmentScope } from "./WorkoutAdjustmentScope";

const reasons: { value: Reason; label: string; accessibleLabel: string }[] = [
  { value: "TIME_SHORT", label: "时间不足", accessibleLabel: "可用时间不够" },
  {
    value: "FATIGUE",
    label: "疲劳或睡眠差",
    accessibleLabel: "疲劳或睡眠不足",
  },
  { value: "WEATHER", label: "天气影响", accessibleLabel: "天气不适合" },
  { value: "SCHEDULE", label: "临时有事", accessibleLabel: "临时有事" },
  { value: "TOO_HARD", label: "课程太难", accessibleLabel: "课程太难" },
  { value: "MISSED", label: "之前漏练", accessibleLabel: "之前漏练" },
];

export function WorkoutAdjustmentForm({
  form,
  loading,
  error,
  onSubmit,
}: {
  form: WorkoutAdjustmentFormState;
  loading: boolean;
  error: string | null;
  onSubmit: SubmitWorkoutAdjustment;
}) {
  const {
    reason,
    setReason,
    scope,
    setScope,
    scheduledDate,
    endDate,
    setEndDate,
    notes,
    setNotes,
    validRange,
    confirm,
  } = form;

  return (
    <View className="gap-6" testID="workout-adjustment-form">
      <View testID="workout-adjustment-reasons">
        <AppText variant="section">发生了什么</AppText>
        <AppText variant="caption" className="mb-3 mt-2 text-secondary">
          选择最主要的原因，再补充具体变化。
        </AppText>
        <View className="flex-row flex-wrap gap-2">
          {reasons.map(({ value, label, accessibleLabel }) => {
            const selected = reason === value;
            return (
              <Pressable
                key={value}
                disabled={loading}
                accessibilityRole="radio"
                accessibilityLabel={accessibleLabel}
                accessibilityState={{ checked: selected, disabled: loading }}
                aria-checked={selected}
                onPress={() => {
                  setReason(value);
                }}
                className={`min-h-12 min-w-[120px] flex-1 basis-[45%] flex-row items-center gap-2 rounded-xl border px-3 py-3 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${loading ? "opacity-50" : "active:opacity-70"}`}
              >
                <AppText
                  variant="caption"
                  className={`flex-1 ${selected ? "text-brand" : "text-secondary"}`}
                >
                  {label}
                </AppText>
                <View
                  className={`h-4 w-4 items-center justify-center rounded-full border ${selected ? "border-brand bg-brand" : "border-border"}`}
                >
                  {selected ? <Check size={11} color={colors.brandOn} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <WorkoutAdjustmentScope
        value={scope}
        onChange={(value) => {
          setScope(value);
        }}
        scheduledDate={scheduledDate}
        endDate={endDate}
        onEndDateChange={(value) => {
          setEndDate(value);
        }}
        disabled={loading}
        validRange={validRange}
      />
      <View testID="workout-adjustment-notes">
        <View className="mb-3 flex-row items-center justify-between">
          <AppText variant="section">补充说明</AppText>
          <AppText variant="caption" className="text-secondary">
            选填
          </AppText>
        </View>
        <Input
          editable={!loading}
          accessibilityLabel="调整原因补充说明"
          value={notes}
          onChangeText={(value) => {
            setNotes(value);
          }}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 120 }}
          className="py-4"
          maxLength={200}
          placeholder="例如：昨晚只睡了 5 小时"
        />
        <AppText variant="caption" className="mt-2 text-right text-secondary">
          {notes.length}/200
        </AppText>
      </View>
      <View className="gap-3">
        <AppText variant="caption" className="text-secondary">
          AI 会结合原训练目的生成草稿，预览并确认后才更新正式计划。
        </AppText>
        {error ? (
          <AppText accessibilityLiveRegion="polite" className="text-negative">
            {error}
          </AppText>
        ) : null}
      </View>
      <Dialog
        visible={confirm}
        title="确认后续联动范围"
        description={`将为 ${scheduledDate} 至 ${endDate} 的未来未记录课程生成替代草稿。请在差异预览中核对全部受影响课程后再应用。`}
        onClose={form.closeConfirmation}
        closeLabel="返回修改"
      >
        <Button
          className="mt-5"
          disabled={loading || !validRange}
          onPress={() => {
            form.confirmSubmit(onSubmit);
          }}
        >
          确认范围并生成草稿
        </Button>
      </Dialog>
    </View>
  );
}
