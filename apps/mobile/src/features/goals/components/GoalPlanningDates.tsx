import { View } from "react-native";
import { AppText } from "../../../components/ui";
import { DatePickerField } from "../../../components/ui/DatePickerField";
import { addDays } from "../../coach/model/plan-dates";

export function GoalPlanningDates({
  startDate,
  endDate,
  today,
  disabled,
  onChange,
  startLabel = "开始日期",
  endLabel = "结束日期",
  label = "训练日期",
}: {
  startDate: string;
  endDate: string;
  today: string;
  disabled: boolean;
  onChange: (start: string, end: string) => void;
  startLabel?: string;
  endLabel?: string;
  label?: string;
}) {
  const days =
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText variant="caption" className="text-secondary">
          {label}
        </AppText>
        <AppText variant="caption" className="tabular-nums text-secondary">
          共 {days} 天
        </AppText>
      </View>
      <View className="overflow-hidden rounded-xl border border-border bg-surface-2">
        <DatePickerField
          label={startLabel}
          value={startDate}
          minimumDate={today}
          disabled={disabled}
          onChange={(next) => {
            const nextEnd =
              endDate < next || endDate > addDays(next, 364)
                ? addDays(next, Math.max(1, Math.min(365, days)) - 1)
                : endDate;
            onChange(next, nextEnd);
          }}
        />
        <View className="mx-4 border-t border-divider" />
        <DatePickerField
          label={endLabel}
          value={endDate}
          minimumDate={startDate < today ? today : startDate}
          maximumDate={addDays(startDate, 364)}
          disabled={disabled}
          onChange={(next) => onChange(startDate, next)}
        />
      </View>
    </View>
  );
}
