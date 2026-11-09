import type { CalendarResponse } from "@ridepilot/contracts";
import type { CalendarView } from "../model/calendar-period";
import { TrainingCalendarGrid } from "./TrainingCalendarGrid";
import { Pressable, View } from "react-native";
import { Bike, ChevronRight, Plus, RefreshCw } from "lucide-react-native";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { AppHeader } from "../../../components/layout/AppHeader";
import { colors } from "../../../theme/tokens";
import type { Workout } from "../model/training";
import { dateLabel, weekday } from "../model/training";
import { styles } from "./training.styles";
import { WorkoutProfileChart } from "./WorkoutProfileChart";

export function Home({
  days,
  events = [],
  view = "WEEK",
  onView = () => undefined,
  today,
  onReschedule,
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
}: {
  days: string[];
  today: string;
  view?: CalendarView;
  events?: NonNullable<CalendarResponse["events"]>;
  onView?: (view: CalendarView) => void;
  onReschedule: (workout: Workout) => void;
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
  return (
    <View style={styles.page}>
      <AppHeader
        eyebrow="骑行训练计划"
        title="训练"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="刷新训练日历"
            style={styles.iconButton}
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
      />
      <View style={styles.dateRow}>
        <AppText variant="section">
          {dateLabel(selectedDate)} · {weekday(selectedDate)}
        </AppText>
        <AppText variant="caption" muted>
          {selectedWorkouts.length} 节课程
        </AppText>
      </View>
      {feedback ? (
        <AppText variant="caption" style={styles.error}>
          {feedback}
        </AppText>
      ) : null}
      {!loading && !feedback
        ? events
            .filter((e) => e.date === selectedDate)
            .map((e) => (
              <Card key={e.id}>
                <AppText variant="card">
                  {e.kind === "REST" ? "休息" : "恢复"} · {e.title}
                </AppText>
              </Card>
            ))
        : null}
      {!loading &&
      !feedback &&
      !selectedWorkouts.length &&
      !events.some((e) => e.date === selectedDate) ? (
        <AppText muted>当天未安排课程；请同时查看下方测试与赛事。</AppText>
      ) : null}
      {loading ? (
        <Spinner accessibilityLabel="正在加载训练日历" />
      ) : (
        selectedWorkouts.map((item) => (
          <Card key={item.id} style={styles.workout}>
            <View style={styles.workoutTop}>
              <View style={styles.source}>
                <Bike size={14} color={colors.positive} />
                <AppText variant="label" style={styles.positive}>
                  {item.source === "ai" ? "AI 教练 · 正式" : "手动创建 · 正式"}
                </AppText>
              </View>
              <AppText variant="caption" muted>
                第 {item.dayOrder} 节
              </AppText>
            </View>
            <AppText variant="card">{item.title || "骑行训练"}</AppText>
            <AppText variant="caption" muted>
              {item.purpose || "结构化骑行课程"}
            </AppText>
            <View style={styles.chips}>
              <AppText variant="label" style={styles.chip}>
                {item.timeTargetMinutes
                  ? `${item.timeTargetMinutes} 分钟`
                  : "无时间目标"}
              </AppText>
              {item.distanceTargetKm ? (
                <AppText variant="label" style={styles.chip}>
                  {item.distanceTargetKm} 公里
                </AppText>
              ) : null}
              <AppText variant="label" style={styles.chip}>
                {item.segments.length} 个动作
              </AppText>
            </View>
            <WorkoutProfileChart segments={item.segments} />
            <View style={styles.buttonRow}>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => onDetail(item)}
              >
                查看课程
              </Button>
              {item.scheduledDate >= today &&
              item.editable !== false &&
              !item.activity ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => onAdjust(item)}
                >
                  {item.scheduledDate === today ? "调整今天" : "AI 调整"}
                </Button>
              ) : null}
              {item.scheduledDate >= today &&
              item.editable !== false &&
              !item.activity ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => onReschedule(item)}
                >
                  课程改期
                </Button>
              ) : null}
              <Button
                disabled={
                  item.editable === false ||
                  !!item.activity ||
                  item.scheduledDate < today
                }
                variant="ghost"
                size="sm"
                onPress={() => onEdit(item)}
              >
                编辑动作
              </Button>
            </View>
          </Card>
        ))
      )}
      <Pressable style={styles.addCard} onPress={onAdd}>
        <View style={styles.plus}>
          <Plus size={20} color={colors.brand} />
        </View>
        <View style={styles.addCopy}>
          <AppText variant="card" style={styles.brand}>
            添加计划
          </AppText>
          <AppText variant="caption" muted>
            手动创建新的骑行课程
          </AppText>
        </View>
        <ChevronRight size={19} color={colors.brand} />
      </Pressable>
    </View>
  );
}
