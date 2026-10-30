import { ImageBackground, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CalendarResponse } from "@ridepilot/contracts";

import { AppText, Badge, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { WorkoutProfileChart } from "../../training/components/WorkoutProfileChart";
import { dateLabel } from "../../training/model/training";
import type { HomeResource } from "../hooks/useHomeData";
import { HomeEmptyPlanCard } from "./HomeEmptyPlanCard";
import { HomeResourceFeedback } from "./HomeResourceFeedback";

type Workout = CalendarResponse["items"][number];
const statusLabel = {
  COMPLETED: "已完成",
  PARTIAL: "部分完成",
  SKIPPED: "已跳过",
};

export function HomeTrainingSection({
  training,
  hasPlan,
  next,
  onRetry,
  onCalendar,
  onCreate,
  onWorkout,
}: {
  training: HomeResource<CalendarResponse>;
  hasPlan: boolean | undefined;
  next: HomeResource<Workout>;
  onRetry: () => void;
  onCalendar: () => void;
  onCreate: () => void;
  onWorkout: (workout: Workout, action?: "adjust" | "feedback") => void;
}) {
  const workouts = training.data?.items ?? [];
  const actionable = !training.loading && !training.error;
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="section">今日训练</AppText>
        <Button size="sm" variant="ghost" onPress={onCalendar}>
          训练日历 →
        </Button>
      </View>
      <HomeResourceFeedback
        {...training}
        cached={!!training.data}
        label="今日训练"
        onRetry={onRetry}
      />
      {hasPlan === false && actionable && !workouts.length ? (
        <HomeEmptyPlanCard onCreate={onCreate} />
      ) : null}
      {hasPlan === true && actionable && !workouts.length ? (
        <Card style={{ gap: 12, padding: 20 }}>
          <Badge variant="neutral">今日安排</Badge>
          <AppText variant="section">今天暂无训练安排</AppText>
          <AppText variant="caption" muted>
            按自己的节奏安排今天，无需为了填满日历而补课。
          </AppText>
          <HomeResourceFeedback
            {...next}
            cached={!!next.data}
            label="下次训练"
            onRetry={onRetry}
          />
          {next.data ? (
            <Button variant="secondary" onPress={() => onWorkout(next.data!)}>
              下次训练：{dateLabel(next.data.scheduledDate)} ·{" "}
              {next.data.title || "骑行训练"}
            </Button>
          ) : !next.loading && !next.error ? (
            <AppText variant="caption" muted>
              暂未安排后续课程，可在 AI 教练中规划。
            </AppText>
          ) : null}
          <Button variant="ghost" onPress={onCreate}>
            手动添加今天的训练
          </Button>
        </Card>
      ) : null}
      {workouts.map((workout, index) => (
        <Card key={workout.id} className="overflow-hidden !p-0">
          <ImageBackground
            source={require("../../../../assets/road-cycling-hero.png")}
            resizeMode="cover"
          >
            <LinearGradient
              colors={[colors.scrim, colors.background]}
              style={{ gap: 12, padding: 20 }}
            >
              <View className="flex-row flex-wrap items-center gap-2">
                <Badge variant="brand">
                  第 {workout.dayOrder} 节 · 正式训练
                </Badge>
                {workout.activity ? (
                  <Badge variant="positive">
                    {statusLabel[workout.activity.status]}
                  </Badge>
                ) : null}
              </View>
              <AppText variant="display" className="text-brand">
                {workout.timeTargetMinutes
                  ? `${workout.timeTargetMinutes} 分钟`
                  : workout.distanceTargetKm
                    ? `${workout.distanceTargetKm} 公里`
                    : "查看训练目标"}
              </AppText>
              {workout.timeTargetMinutes && workout.distanceTargetKm ? (
                <AppText variant="caption" muted>
                  另含 {workout.distanceTargetKm} 公里距离目标，不折算时长
                </AppText>
              ) : null}
              <AppText variant="section">{workout.title || "骑行训练"}</AppText>
              <AppText className="text-secondary">
                {workout.purpose || "按结构化区段完成今天的训练"}
              </AppText>
              <WorkoutProfileChart segments={workout.segments} />
              {workout.activity ? (
                <AppText variant="caption" className="text-positive">
                  {statusLabel[workout.activity.status]}
                  {workout.activity.durationMin !== null
                    ? ` · 实际 ${workout.activity.durationMin} 分钟`
                    : ""}
                  {workout.activity.rpe !== null
                    ? ` · RPE ${workout.activity.rpe}`
                    : ""}
                </AppText>
              ) : null}
              <Button
                size="lg"
                variant={index === 0 ? "primary" : "secondary"}
                onPress={() => onWorkout(workout)}
              >
                查看
                {workouts.length === 1
                  ? "今日训练"
                  : `第 ${workout.dayOrder} 节训练`}
              </Button>
              {!workout.activity && actionable ? (
                <View className="flex-row gap-2">
                  {workout.editable !== false ? (
                    <Button
                      className="flex-1"
                      variant="secondary"
                      onPress={() => onWorkout(workout, "adjust")}
                    >
                      调整这节训练
                    </Button>
                  ) : null}
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onPress={() => onWorkout(workout, "feedback")}
                  >
                    记录完成情况
                  </Button>
                </View>
              ) : null}
            </LinearGradient>
          </ImageBackground>
        </Card>
      ))}
    </View>
  );
}
