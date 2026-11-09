import { Pressable, View } from "react-native";
import type { CalendarResponse } from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/tokens";
import type { CalendarView } from "../model/calendar-period";
import { dateLabel, weekday } from "../model/training";

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
}) {
  return (
    <Card>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText variant="card">
          {view === "MONTH"
            ? `${selectedDate.slice(0, 4)} 年 ${Number(selectedDate.slice(5, 7))} 月`
            : `${dateLabel(days[0])}—${dateLabel(days[6])}`}
        </AppText>
        <View className="flex-row gap-2">
          <Button
            size="sm"
            variant={view === "WEEK" ? "primary" : "secondary"}
            onPress={() => onView("WEEK")}
          >
            周视图
          </Button>
          <Button
            size="sm"
            variant={view === "MONTH" ? "primary" : "secondary"}
            onPress={() => onView("MONTH")}
          >
            月视图
          </Button>
        </View>
      </View>
      <View className="my-2 flex-row justify-between">
        <Button
          size="sm"
          variant="ghost"
          accessibilityLabel={view === "MONTH" ? "上一月" : "上一周"}
          onPress={onPrev}
        >
          ‹
        </Button>
        <Button
          size="sm"
          variant="ghost"
          accessibilityLabel={view === "MONTH" ? "下一月" : "下一周"}
          onPress={onNext}
        >
          ›
        </Button>
      </View>
      <View className="flex-row flex-wrap">
        {days.map((day) => {
          const labels = [
            workouts.some((w) => w.scheduledDate === day) ? "课程" : "",
            assessmentDates.includes(day) ? "测试" : "",
            raceDates.includes(day) ? "比赛" : "",
            ...events
              .filter((e) => e.date === day)
              .map((e) => (e.kind === "REST" ? "休息" : "恢复")),
          ].filter(Boolean);
          const selected = day === selectedDate;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${day}${assessmentDates.includes(day) ? "，有阶段测试" : ""}${raceDates.includes(day) ? "，有比赛" : ""}${events.some((e) => e.date === day && e.kind === "REST") ? "，休息" : ""}${workouts.some((w) => w.scheduledDate === day) ? "，有课程" : ""}${labels.length ? "" : "，未安排"}`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(day)}
              style={{
                width: "14.285714%",
                minHeight: 78,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                borderRadius: 10,
                backgroundColor: selected ? colors.brand : undefined,
                opacity:
                  view === "MONTH" &&
                  day.slice(0, 7) !== selectedDate.slice(0, 7)
                    ? 0.55
                    : 1,
              }}
            >
              <AppText
                variant="caption"
                style={{
                  color: selected ? colors.brandOn : colors.textSecondary,
                }}
              >
                {weekday(day)}
              </AppText>
              <AppText
                variant="card"
                style={{
                  color: selected ? colors.brandOn : colors.textPrimary,
                }}
              >
                {Number(day.slice(-2))}
              </AppText>
              <AppText
                variant="caption"
                style={{
                  color: selected ? colors.brandOn : colors.textSecondary,
                }}
              >
                {labels.join("·") || "—"}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
