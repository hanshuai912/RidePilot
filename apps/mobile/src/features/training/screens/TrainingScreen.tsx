import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { CalendarResponse } from "@ridepilot/contracts";
import { Screen } from "../../../components/layout/Screen";
import { AppText } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { Home } from "../components/Home";
import { styles } from "../components/training.styles";
import { addDays, isTrainingDate, iso, type Workout } from "../model/training";
import { trainingApi } from "../services/training.api";

export function TrainingScreen() {
  const { savedAt, date } = useLocalSearchParams<{
    savedAt?: string;
    date?: string;
  }>();
  return (
    <TrainingCalendar key={date ?? "current"} date={date} savedAt={savedAt} />
  );
}

function TrainingCalendar({
  date,
  savedAt,
}: {
  date?: string;
  savedAt?: string;
}) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const today = iso(new Date());
  const initialDate = date && isTrainingDate(date) ? date : today;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [weekStart, setWeekStart] = useState(
    addDays(
      initialDate,
      -((new Date(`${initialDate}T12:00:00`).getDay() + 6) % 7),
    ),
  );
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const weekEnd = addDays(weekStart, 6);
  const moveWeek = (offsetDays: number) => {
    setWeekStart((current) => addDays(current, offsetDays));
    setSelectedDate((current) => addDays(current, offsetDays));
  };
  useFocusEffect(
    useCallback(() => {
      void attempt;
      if (!token) return;
      let active = true;
      setLoading(true);
      setFeedback(null);
      trainingApi
        .getCalendar(token, weekStart, weekEnd)
        .then((data) => {
          if (active) setCalendar(data);
        })
        .catch((error: unknown) => {
          if (active) {
            setCalendar(null);
            setFeedback(
              error instanceof Error ? error.message : "训练日历加载失败",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [token, weekStart, weekEnd, attempt]),
  );
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const edit = (workout: Workout) =>
    router.push({
      pathname: "/workouts/editor",
      params: { workoutId: workout.id },
    });
  if (!token)
    return (
      <Screen>
        <AppText>请先登录后查看训练计划。</AppText>
      </Screen>
    );
  return (
    <Screen scroll scrollProps={{ contentContainerStyle: styles.content }}>
      {savedAt ? (
        <AppText accessibilityLiveRegion="polite" style={styles.positive}>
          保存成功
        </AppText>
      ) : null}
      <Home
        days={days}
        selectedDate={selectedDate}
        workouts={calendar?.items ?? []}
        selectedWorkouts={
          calendar?.items.filter(
            (item) => item.scheduledDate === selectedDate,
          ) ?? []
        }
        loading={loading}
        feedback={feedback}
        setSelectedDate={setSelectedDate}
        onPrev={() => moveWeek(-7)}
        onNext={() => moveWeek(7)}
        onRefresh={() => setAttempt((value) => value + 1)}
        onAdd={() =>
          router.push({
            pathname: "/workouts/new",
            params: { date: selectedDate < today ? today : selectedDate },
          })
        }
        onDetail={(workout) =>
          router.push({
            pathname: "/workouts/[workoutId]",
            params: { workoutId: workout.id },
          })
        }
        onAdjust={(workout) =>
          router.push({
            pathname: "/workouts/[workoutId]",
            params: { workoutId: workout.id, action: "adjust" },
          })
        }
        onEdit={edit}
      />
    </Screen>
  );
}
