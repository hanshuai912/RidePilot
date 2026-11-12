import type { ReactNode } from "react";
import type { CalendarResponse } from "@ridepilot/contracts";
import type { CalendarView } from "../model/calendar-period";
import { TrainingCalendarGrid } from "./TrainingCalendarGrid";
import { Pressable, View } from "react-native";
import { Plus, RefreshCw } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { AppHeader } from "../../../components/layout/AppHeader";
import { colors } from "../../../theme/tokens";
import type { Workout } from "../model/training";
import { dateLabel, weekday } from "../model/training";
import { styles as sharedStyles } from "./training.styles";
import { styles } from "./training-home.styles";
import { ScheduledWorkoutCard } from "./ScheduledWorkoutCard";
import { TrainingDayState } from "./TrainingDayState";
import { calendarDayActivity } from "../model/calendar-day";

export function Home({
  days,
  events = [],
  view = "WEEK",
  onView = () => undefined,
  today,
  assessmentDates = [],
  raceDates = [],
  selectedDate,
  selectedWorkouts,
  workouts,
  loading,
  feedback,
  setSelectedDate,
  onPrev,
  onNext,
  onRefresh,
  onAdd,
  onDetail,
  onAdjust,
  onEdit,
  calendarFooter,
  dayEvents,
}: {
  calendarFooter?: ReactNode;
  dayEvents?: ReactNode;
  days: string[];
  today: string;
  view?: CalendarView;
  events?: NonNullable<CalendarResponse["events"]>;
  onView?: (view: CalendarView) => void;
  assessmentDates?: string[];
  raceDates?: string[];
  selectedDate: string;
  selectedWorkouts: Workout[];
  workouts: Workout[];
  loading: boolean;
  feedback: string | null;
  setSelectedDate: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onRefresh: () => void;
  onAdd: () => void;
  onDetail: (workout: Workout) => void;
  onAdjust: (workout: Workout) => void;
  onEdit: (workout: Workout) => void;
}) {
  const dayActivity = calendarDayActivity(selectedDate, {
    workouts,
    events,
    raceDates,
    assessmentDates,
  });
  const past = selectedDate < today;
  return (
    <View style={styles.page}>
      <AppHeader
        className="!mb-0"
        title="训练"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="刷新训练日历"
            style={sharedStyles.iconButton}
            onPress={onRefresh}
          >
            <RefreshCw size={18} color={colors.brand} strokeWidth={1.8} />
          </Pressable>
        }
      />
      <TrainingCalendarGrid
        days={days}
        selectedDate={selectedDate}
        view={view}
        events={events}
        workouts={workouts}
        assessmentDates={assessmentDates}
        raceDates={raceDates}
        onSelect={setSelectedDate}
        onView={onView}
        onPrev={onPrev}
        onNext={onNext}
        footer={calendarFooter}
        today={today}
        scheduleReady={!loading && !feedback}
      />
      <View testID="training-day-section" style={styles.daySection}>
        <View style={styles.dateRow}>
          <View style={styles.dayHeading}>
            <AppText variant="section">
              {selectedDate === today ? "今日安排" : "训练安排"}
            </AppText>
            <AppText variant="caption" muted>
              {dateLabel(selectedDate)} · {weekday(selectedDate)}
              {!loading && !feedback && selectedWorkouts.length
                ? ` · ${selectedWorkouts.length} 节课程`
                : ""}
            </AppText>
          </View>
          {selectedDate !== today ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="回到今天"
              onPress={() => setSelectedDate(today)}
              style={styles.todayButton}
            >
              <AppText variant="label" style={styles.brand}>
                回到今天
              </AppText>
            </Pressable>
          ) : null}
        </View>
        {dayEvents}
        {loading || feedback || !selectedWorkouts.length ? (
          <TrainingDayState
            loading={loading}
            error={feedback}
            activity={dayActivity}
            onRetry={onRefresh}
          />
        ) : (
          selectedWorkouts.map((item) => (
            <ScheduledWorkoutCard
              key={item.id}
              item={item}
              today={today}
              onDetail={() => onDetail(item)}
              onAdjust={() => onAdjust(item)}
              onEdit={() => onEdit(item)}
            />
          ))
        )}
        {!loading && !feedback && !past ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="添加计划"
            style={styles.addRow}
            onPress={onAdd}
          >
            <Plus size={18} color={colors.brand} />
            <AppText variant="label" style={styles.brand}>
              添加计划
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
