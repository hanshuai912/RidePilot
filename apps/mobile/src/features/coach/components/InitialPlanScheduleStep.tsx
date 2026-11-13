import { Pressable, View } from "react-native";
import { Check, CalendarDays } from "lucide-react-native";
import { AppText, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { SetupSection } from "./SetupSection";

const weekdays = [
  [1, "周一"],
  [2, "周二"],
  [3, "周三"],
  [4, "周四"],
  [5, "周五"],
  [6, "周六"],
  [0, "周日"],
] as const;

export function ScheduleStep({
  days,
  setDays,
  minutes,
  setMinutes,
  disabled = false,
}: {
  days: number[];
  setDays: (value: number[]) => void;
  minutes: number;
  setMinutes: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <Card className="gap-4 p-5">
        <View className="flex-row items-center gap-2">
          <CalendarDays size={18} color={colors.brand} />
          <AppText variant="card">每周训练安排</AppText>
        </View>
        <View className="flex-row gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="title" className="tabular-nums text-brand">
              {days.length} 天
            </AppText>
            <AppText variant="caption" className="text-secondary">
              已选可训练日
            </AppText>
          </View>
          <View className="min-w-0 flex-1 gap-1 border-l border-divider pl-4">
            <AppText variant="title" className="tabular-nums text-brand">
              {minutes} 分钟
            </AppText>
            <AppText variant="caption" className="text-secondary">
              单次时长上限
            </AppText>
          </View>
        </View>
        <AppText variant="caption" className="text-secondary">
          这是可用时间，实际课程会结合恢复需要安排。
        </AppText>
      </Card>
      <SetupSection
        title="每周可训练日"
        description="可多选，未选日期作为休息日。"
      >
        <View className="flex-row flex-wrap gap-2">
          {weekdays.map(([day, label]) => {
            const checked = days.includes(day);
            return (
              <Pressable
                key={day}
                accessibilityRole="checkbox"
                accessibilityLabel={label}
                accessibilityState={{ checked, disabled }}
                disabled={disabled}
                onPress={() =>
                  setDays(
                    checked
                      ? days.filter((value) => value !== day)
                      : [...days, day],
                  )
                }
                style={{ flexBasis: "22%", flexGrow: 1 }}
                className={`min-h-20 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-3 ${checked ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
              >
                <AppText
                  variant="card"
                  className={checked ? "text-brand" : "text-primary"}
                >
                  {label}
                </AppText>
                <View
                  accessible={false}
                  className={`h-5 w-5 items-center justify-center rounded-full border ${checked ? "border-brand bg-brand" : "border-neutral"}`}
                >
                  {checked ? (
                    <Check size={13} color={colors.brandOn} strokeWidth={2} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        {!days.length ? (
          <AppText variant="caption" className="text-warning">
            至少选择一个可训练日。
          </AppText>
        ) : null}
      </SetupSection>
      <SetupSection
        title="单次可训练时间上限"
        description="按通常能留出的时间选择，课程可能比上限更短。"
      >
        <View className="flex-row flex-wrap gap-2">
          {[...new Set([45, 60, 90, 120, minutes])]
            .sort((a, b) => a - b)
            .map((value) => {
              const selected = value === minutes;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${value} 分钟`}
                  accessibilityState={{ selected, checked: selected, disabled }}
                  disabled={disabled}
                  onPress={() => setMinutes(value)}
                  style={{ flexBasis: "46%", flexGrow: 1 }}
                  className={`min-h-16 min-w-0 items-center justify-center rounded-xl border px-3 py-4 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
                >
                  <AppText
                    variant="section"
                    className={
                      selected ? "tabular-nums text-brand" : "tabular-nums"
                    }
                  >
                    {value} 分钟
                  </AppText>
                </Pressable>
              );
            })}
        </View>
      </SetupSection>
    </>
  );
}
