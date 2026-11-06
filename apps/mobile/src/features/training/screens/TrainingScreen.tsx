import { PlanImpactEntryCard } from "../../plan-impact/components/PlanImpactEntryCard";
import { TrainingNutritionLinkCard } from "../../nutrition/components/TrainingNutritionLinkCard";
import { coachApi } from "../../coach/services/coach.api";
import { RaceDayEvents } from "../../races/components/RaceDayEvents";
import { assessmentsApi } from "../../assessments/services/assessments.api";
import { AssessmentList } from "../../assessments/components/AssessmentList";
import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { CalendarResponse, Assessment } from "@ridepilot/contracts";
import { Screen } from "../../../components/layout/Screen";
import { AppText, Button } from "../../../components/ui";
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
  const [races, setRaces] = useState<
    Awaited<ReturnType<typeof coachApi.races>>
  >([]);
  const [raceError, setRaceError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
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
      Promise.allSettled([
        trainingApi.getCalendar(token, weekStart, weekEnd),
        assessmentsApi.list(token, { from: weekStart, to: weekEnd }),
        Promise.resolve().then(() => coachApi.races(token)),
      ]).then(([courses, tests, events]) => {
        if (!active) return;
        if (courses.status === "fulfilled") setCalendar(courses.value);
        else
          setFeedback(
            courses.reason instanceof Error
              ? courses.reason.message
              : "训练日历加载失败",
          );
        if (tests.status === "fulfilled") {
          setAssessments(tests.value);
          setAssessmentError(null);
        } else
          setAssessmentError(
            tests.reason instanceof Error
              ? tests.reason.message
              : "测试日程加载失败",
          );
        if (events.status === "fulfilled") {
          setRaces(events.value.filter((race) => race.status !== "CANCELLED"));
          setRaceError(null);
        } else setRaceError("赛事日程读取失败，请刷新重试");
        setLoading(false);
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
        assessmentDates={assessments.map((item) => item.localDate)}
        raceDates={races.map((item) => item.localDate)}
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
            pathname: "/workouts/adjust",
            params: { workoutId: workout.id, source: "training" },
          })
        }
        onEdit={edit}
      />
      <PlanImpactEntryCard />
      <TrainingNutritionLinkCard dates={[selectedDate]} checkStatus />
      {raceError ? (
        <AppText className="text-negative">{raceError}</AppText>
      ) : null}
      <RaceDayEvents
        races={races.filter((race) => race.localDate === selectedDate)}
      />
      <AppText variant="section">当日阶段测试</AppText>
      {assessments.some(
        (item) =>
          item.localDate === selectedDate &&
          ["SCHEDULED", "POSTPONED"].includes(item.status),
      ) &&
      calendar?.items.some((item) => item.scheduledDate === selectedDate) ? (
        <AppText muted>
          当天同时安排了课程和测试，请检查是否需要改期或另行调整课程。
        </AppText>
      ) : null}
      <AssessmentList
        items={assessments.filter((item) => item.localDate === selectedDate)}
        empty="当天没有测试安排"
      />
      {assessmentError ? (
        <>
          <AppText style={styles.error}>{assessmentError}</AppText>
          <Button
            variant="secondary"
            onPress={() => setAttempt((value) => value + 1)}
          >
            重试读取日程
          </Button>
        </>
      ) : null}
      <Button
        variant="secondary"
        onPress={() => router.push("/(tabs)/coach/cycle-review")}
      >
        训练执行与周期复盘
      </Button>
      <Button variant="secondary" onPress={() => router.push("/goals")}>
        目标与阶段 · 生成课程
      </Button>
      <Button
        variant="secondary"
        onPress={() => router.push("/races" as never)}
      >
        赛事管理 · 备赛与赛后恢复
      </Button>
    </Screen>
  );
}
