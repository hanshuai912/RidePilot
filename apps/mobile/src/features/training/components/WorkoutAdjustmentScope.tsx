import { Pressable, View } from "react-native";
import { AppText } from "../../../components/ui";
import { DatePickerField } from "../../../components/ui/DatePickerField";
import { addDays } from "../model/training";

import type { WorkoutAdjustmentScopeValue } from "../hooks/useWorkoutAdjustmentForm";

export function WorkoutAdjustmentScope({
  value,
  onChange,
  scheduledDate,
  endDate,
  onEndDateChange,
  disabled,
  validRange,
}: {
  value: WorkoutAdjustmentScopeValue;
  onChange: (value: WorkoutAdjustmentScopeValue) => void;
  scheduledDate: string;
  endDate: string;
  onEndDateChange: (value: string) => void;
  disabled: boolean;
  validRange: boolean;
}) {
  return (
    <View testID="workout-adjustment-scope" className="gap-3">
      <AppText variant="section">调整哪些课程</AppText>
      <View className="flex-row flex-wrap gap-2">
        {(
          [
            ["SINGLE", "仅此课程"],
            ["FUTURE", "联动后续课程"],
          ] as const
        ).map(([scope, label]) => (
          <Pressable
            key={scope}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: value === scope, disabled }}
            aria-checked={value === scope}
            disabled={disabled}
            onPress={() => onChange(scope)}
            className={`min-h-12 min-w-[120px] flex-1 items-center justify-center rounded-xl border px-2 py-3 ${value === scope ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
          >
            <AppText
              className={
                value === scope ? "font-medium text-brand" : "text-secondary"
              }
            >
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      <AppText variant="caption" className="text-secondary">
        {value === "SINGLE"
          ? "只为这节课生成替代草稿，其他课程保持不变。"
          : "从这节课起调整所选日期内的未记录课程，最多 84 天。"}
      </AppText>
      {value === "FUTURE" ? (
        <>
          <View className="overflow-hidden rounded-xl border border-border bg-surface">
            <View className="gap-1 px-4 py-3">
              <AppText variant="caption" className="text-secondary">
                开始日期
              </AppText>
              <AppText className="tabular-nums">{scheduledDate}</AppText>
            </View>
            <View className="mx-4 border-t border-divider" />
            <DatePickerField
              label="后续联动结束日期"
              value={endDate}
              minimumDate={scheduledDate}
              maximumDate={addDays(scheduledDate, 83)}
              disabled={disabled}
              onChange={onEndDateChange}
            />
          </View>
          <AppText variant="caption" className="text-secondary">
            已记录课程保留；阶段、测试与补给需另行确认。
          </AppText>
          {!validRange ? (
            <AppText variant="caption" className="text-negative">
              请选择有效结束日期，范围不得超过 84 天
            </AppText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
