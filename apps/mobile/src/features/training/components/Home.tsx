import { Pressable, View } from "react-native";
import { Bike, ChevronRight, Plus, RefreshCw } from "lucide-react-native";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/tokens";
import type { Workout } from "../model/training";
import { dateLabel, weekday } from "../model/training";
import { styles } from "./training.styles";

export function Home({
  days,
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
  onEdit,
}: {
  days: string[];
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
  onEdit: (workout: Workout) => void;
}) {
  return (
    <View style={styles.page}>
      <View style={styles.headerRow}>
        <View>
          <AppText variant="label" style={styles.eyebrow}>
            人工训练计划
          </AppText>
          <AppText variant="display">训练</AppText>
        </View>
        <Pressable onPress={onRefresh}>
          <RefreshCw size={19} color={colors.brand} />
        </Pressable>
      </View>
      <Card style={styles.calendar}>
        <View style={styles.calendarHead}>
          <AppText variant="section">
            {dateLabel(days[0])}—{dateLabel(days[6])}
          </AppText>
          <View style={styles.calendarNav}>
            <Pressable onPress={onPrev}>
              <AppText variant="section" style={styles.nav}>
                ‹
              </AppText>
            </Pressable>
            <Pressable onPress={onNext}>
              <AppText variant="section" style={styles.nav}>
                ›
              </AppText>
            </Pressable>
          </View>
        </View>
        <View style={styles.days}>
          {days.map((day) => (
            <Pressable
              key={day}
              onPress={() => setSelectedDate(day)}
              style={[styles.day, day === selectedDate && styles.selectedDay]}
            >
              <AppText
                variant="caption"
                style={
                  day === selectedDate ? styles.selectedDayText : undefined
                }
              >
                {weekday(day)}
              </AppText>
              <AppText
                variant="card"
                style={
                  day === selectedDate ? styles.selectedDayText : undefined
                }
              >
                {Number(day.slice(-2))}
              </AppText>
              <View
                style={[
                  styles.dot,
                  workouts.some((item) => item.scheduledDate === day) &&
                    styles.activeDot,
                ]}
              />
            </Pressable>
          ))}
        </View>
      </Card>
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
      {loading ? (
        <Spinner accessibilityLabel="正在加载训练日历" />
      ) : (
        selectedWorkouts.map((item) => (
          <Card key={item.id} style={styles.workout}>
            <View style={styles.workoutTop}>
              <View style={styles.source}>
                <Bike size={14} color={colors.positive} />
                <AppText variant="label" style={styles.positive}>
                  手动创建 · 正式
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
            <View style={styles.buttonRow}>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => onDetail(item)}
              >
                查看课程
              </Button>
              <Button size="sm" onPress={() => onEdit(item)}>
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
