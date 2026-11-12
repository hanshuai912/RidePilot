import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import type { CalendarResponse } from "@ridepilot/contracts";
import { AppText, Card } from "../../../components/ui";
import { colors } from "../../../theme/tokens";
import type { CalendarView } from "../model/calendar-period";
import { dateLabel, weekday } from "../model/training";
import { styles } from "./training-calendar.styles";
import { TrainingCalendarMarker } from "./TrainingCalendarMarker";
import { calendarDayActivity } from "../model/calendar-day";

export function TrainingCalendarGrid({
  days,
  selectedDate,
  view,
  events,
  workouts,
  assessmentDates,
  raceDates,
  onSelect,
  onView,
  onPrev,
  onNext,
  footer,
  today,
  scheduleReady = true,
}: {
  days: string[];
  selectedDate: string;
  view: CalendarView;
  events: NonNullable<CalendarResponse["events"]>;
  workouts: CalendarResponse["items"];
  assessmentDates: string[];
  raceDates: string[];
  onSelect: (day: string) => void;
  onView: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  footer?: ReactNode;
  today?: string;
  scheduleReady?: boolean;
}) {
  return (
    <Card testID="training-calendar-card" style={styles.card}>
      <View style={styles.header}>
        <AppText variant="card">训练日历</AppText>
        <View style={styles.segment}>
          {(["WEEK", "MONTH"] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: view === mode }}
              onPress={() => onView(mode)}
              style={[
                styles.segmentButton,
                view === mode && styles.activeSegment,
              ]}
            >
              <AppText
                variant="label"
                style={{
                  color: view === mode ? colors.brand : colors.textMuted,
                }}
              >
                {mode === "WEEK" ? "周视图" : "月视图"}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.periodRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.navButton}
          accessibilityLabel={view === "MONTH" ? "上一月" : "上一周"}
          onPress={onPrev}
        >
          <ChevronLeft size={18} color={colors.textSecondary} />
        </Pressable>
        <AppText variant="caption" muted style={styles.periodLabel}>
          {view === "MONTH"
            ? `${selectedDate.slice(0, 4)} 年 ${Number(selectedDate.slice(5, 7))} 月`
            : `${dateLabel(days[0])}—${dateLabel(days[6])}`}
        </AppText>
        <Pressable
          accessibilityRole="button"
          style={styles.navButton}
          accessibilityLabel={view === "MONTH" ? "下一月" : "下一周"}
          onPress={onNext}
        >
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.weekdays}>
        {days.slice(0, 7).map((day) => (
          <AppText key={day} variant="caption" muted style={styles.weekday}>
            {weekday(day)}
          </AppText>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {days.map((day) => {
          const rest =
            scheduleReady &&
            calendarDayActivity(day, {
              workouts,
              events,
              assessmentDates,
              raceDates,
            }) === "REST";
          const selected = day === selectedDate;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${day}${day === today ? "，今天" : ""}${assessmentDates.includes(day) ? "，有阶段测试" : ""}${raceDates.includes(day) ? "，有比赛" : ""}${rest ? "，休息" : ""}${events.some((e) => e.date === day && e.kind === "RECOVERY") ? "，恢复" : ""}${workouts.some((w) => w.scheduledDate === day) ? "，有课程" : ""}${scheduleReady ? "" : "，日程待更新"}`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(day)}
              style={[
                styles.day,
                {
                  backgroundColor: selected ? colors.brand : undefined,
                  opacity:
                    view === "MONTH" &&
                    day.slice(0, 7) !== selectedDate.slice(0, 7)
                      ? 0.55
                      : 1,
                },
              ]}
            >
              <AppText
                variant="card"
                style={{
                  color: selected ? colors.brandOn : colors.textPrimary,
                  textDecorationLine: day === today ? "underline" : "none",
                }}
              >
                {Number(day.slice(-2))}
              </AppText>
              <View style={styles.markers}>
                {(
                  [
                    [
                      workouts.some((w) => w.scheduledDate === day),
                      colors.positive,
                    ],
                    [raceDates.includes(day), colors.warning],
                    [assessmentDates.includes(day), colors.brand],
                    [rest, colors.textMuted],
                    [
                      events.some(
                        (event) =>
                          event.date === day && event.kind === "RECOVERY",
                      ),
                      colors.neutral,
                    ],
                  ] as const
                ).map(([visible, color], index) =>
                  visible ? (
                    <TrainingCalendarMarker
                      key={index}
                      kind={index}
                      color={selected ? colors.brandOn : color}
                    />
                  ) : null,
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        {[
          ["课程", colors.positive],
          ["比赛", colors.warning],
          ["测试", colors.brand],
          ["休息", colors.textMuted],
          ["恢复", colors.neutral],
        ].map(([label, color], index) => (
          <View key={label} style={styles.legendItem}>
            <TrainingCalendarMarker kind={index} color={color} />
            <AppText variant="caption" muted>
              {label}
            </AppText>
          </View>
        ))}
      </View>
      {footer}
    </Card>
  );
}
