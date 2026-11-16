import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react-native";
import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { addDays } from "../../coach/model/plan-dates";
import {
  calendarWeeks,
  dateLabel,
  monthRange,
  shiftMonth,
  weekdays,
  weekStart,
} from "../model/nutrition-dates";
import { useNutritionScheduleRange } from "../hooks/useNutritionScheduleRange";

export function NutritionDateBrowser({
  token,
  date,
  today,
  revision,
  disabled,
  onSelect,
}: {
  token: string;
  date: string;
  today: string;
  revision: number;
  disabled: boolean;
  onSelect: (date: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(date);
  const start = weekStart(date);
  const [from, to] = expanded ? monthRange(month) : [start, addDays(start, 6)];
  const schedule = useNutritionScheduleRange(token, from, to, revision);
  const visibleMonth = expanded ? month : date;
  const rows = expanded
    ? calendarWeeks(month)
    : [Array.from({ length: 7 }, (_, index) => addDays(start, index))];
  return (
    <Card
      padding="none"
      className={`overflow-hidden ${width < 360 ? "-mx-4" : ""}`}
    >
      <View className="flex-row flex-wrap items-center justify-between gap-1 px-3 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "收起饮食月历" : "展开饮食月历"}
          accessibilityState={{ expanded, disabled }}
          disabled={disabled}
          className="min-h-11 flex-row items-center gap-2 rounded-lg px-1 active:bg-surface-2"
          onPress={() => {
            if (!expanded) setMonth(date);
            setExpanded(!expanded);
          }}
        >
          <CalendarDays size={17} color={colors.brand} />
          <AppText variant="card">
            {Number(visibleMonth.slice(0, 4))}年
            {Number(visibleMonth.slice(5, 7))}月
          </AppText>
          {expanded ? (
            <ChevronUp size={15} color={colors.textMuted} />
          ) : (
            <ChevronDown size={15} color={colors.textMuted} />
          )}
        </Pressable>
        <View className="flex-row items-center">
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || (date === today && !expanded)}
            onPress={() => {
              onSelect(today);
              setMonth(today);
              setExpanded(false);
            }}
          >
            今天
          </Button>
          <PeriodArrow
            direction="previous"
            expanded={expanded}
            disabled={disabled}
            onPress={() =>
              expanded
                ? setMonth(shiftMonth(month, -1))
                : onSelect(addDays(date, -7))
            }
          />
          <PeriodArrow
            direction="next"
            expanded={expanded}
            disabled={disabled}
            onPress={() =>
              expanded
                ? setMonth(shiftMonth(month, 1))
                : onSelect(addDays(date, 7))
            }
          />
        </View>
      </View>
      <View className="mt-2 flex-row">
        {weekdays.map((day) => (
          <AppText
            key={day}
            variant="label"
            muted
            className="flex-1 text-center"
          >
            {day}
          </AppText>
        ))}
      </View>
      <View className="mt-1 gap-1">
        {rows.map((row, index) => (
          <View key={index} className="flex-row">
            {row.map((value, column) =>
              value ? (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`${dateLabel(value)}${value === today ? "，今天" : ""}${schedule.dates.has(value) ? "，有正式安排" : ""}`}
                  accessibilityState={{ selected: value === date, disabled }}
                  aria-selected={value === date}
                  disabled={disabled}
                  className="min-h-14 flex-1 items-center justify-center px-0.5 py-1 active:bg-surface-2"
                  onPress={() => {
                    onSelect(value);
                    setExpanded(false);
                  }}
                >
                  <View
                    className={`min-h-9 w-full items-center justify-center rounded-xl border py-1 ${value === date ? "border-brand bg-brand" : value === today ? "border-brand/60" : "border-transparent"}`}
                  >
                    <AppText
                      variant="card"
                      className={
                        value === date ? "text-brand-on" : "text-primary"
                      }
                    >
                      {Number(value.slice(8))}
                    </AppText>
                  </View>
                  <View
                    className={`mt-1 h-1 w-1 rounded-full ${schedule.dates.has(value) ? "bg-brand" : "bg-transparent"}`}
                  />
                </Pressable>
              ) : (
                <View key={`blank-${column}`} className="flex-1" />
              ),
            )}
          </View>
        ))}
      </View>
      <View className="gap-1 border-t border-border px-3 py-3">
        {schedule.error ? (
          <>
            <AppText
              variant="caption"
              accessibilityRole="alert"
              className="text-negative"
            >
              安排日期加载失败，仍可选择日期查看详情。
            </AppText>
            <Button variant="ghost" size="sm" onPress={schedule.retry}>
              重试日期标记
            </Button>
          </>
        ) : (
          <AppText variant="label" muted accessibilityLiveRegion="polite">
            {schedule.loading ? "正在读取安排日期…" : "金点 · 已确认的饮食安排"}
          </AppText>
        )}
      </View>
    </Card>
  );
}

function PeriodArrow({
  direction,
  expanded,
  disabled,
  onPress,
}: {
  direction: "previous" | "next";
  expanded: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${direction === "previous" ? "上一" : "下一"}${expanded ? "个月" : "周"}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-11 min-w-11 items-center justify-center rounded-lg active:bg-surface-2"
    >
      <Icon size={18} color={colors.textSecondary} />
    </Pressable>
  );
}
