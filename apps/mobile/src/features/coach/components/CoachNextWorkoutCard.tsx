import { useCallback } from "react";
import { View } from "react-native";
import { Bike } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { CoachOverview, ProposalResponse } from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { trainingApi } from "../../training/services/training.api";
import {
  useCoachResource,
  type CoachResource,
} from "../hooks/useCoachResource";
import { keyWorkoutIntensity } from "../model/coach-home";

export function CoachNextWorkoutCard({ data }: { data: CoachOverview }) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const next = data.nextWorkout;
  const workoutId = next?.id;
  const load = useCallback(
    () =>
      workoutId && token
        ? trainingApi.getWorkout(token, workoutId)
        : Promise.resolve(null),
    [workoutId, token],
  );
  const detail = useCoachResource(load);
  return <CoachNextWorkoutContent data={data} detail={detail} />;
}

export function CoachNextWorkoutContent({
  data,
  detail,
}: {
  data: CoachOverview;
  detail: CoachResource<ProposalResponse["draftWorkout"]>;
}) {
  const router = useRouter();
  const next = data.nextWorkout;
  const changed =
    !!detail.data &&
    (detail.data.planVersion !== data.planVersion ||
      detail.data.id !== next?.id);
  const workout = !changed ? detail.data : null;
  const intensity = workout ? keyWorkoutIntensity(workout.segments) : null;
  const today = next?.date === data.localDate;
  if (!next)
    return (
      <Card testID="coach-next-workout" className="gap-2">
        <AppText variant="caption" className="text-secondary">
          训练安排
        </AppText>
        <AppText variant="section">
          {data.planVersion ? "暂无待执行训练" : "尚无正式训练计划"}
        </AppText>
        <AppText variant="caption" className="text-secondary">
          {data.planVersion
            ? "可以重新规划，或到日历手动添加课程。"
            : "先建立计划，预览并确认后开始训练。"}
        </AppText>
        <Button
          variant="secondary"
          onPress={() => router.push("/(tabs)/training")}
        >
          查看训练日历
        </Button>
      </Card>
    );
  const minutes = workout?.timeTargetMinutes ?? next.minutes;
  return (
    <Card testID="coach-next-workout" className="border-brand-subtle p-5">
      <View className="flex-row items-center justify-between gap-3">
        <AppText variant="caption" className="text-brand">
          {today ? "今日训练" : "下一次训练"} · {next.date}
        </AppText>
        <Bike color={colors.brand} size={22} strokeWidth={1.8} />
      </View>
      <AppText variant="title" className="mt-3">
        {next.title}
      </AppText>
      <View className="mt-3 flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
        {minutes !== null ? (
          <AppText variant="title" className="text-brand">
            {minutes}
            <AppText variant="caption" className="text-secondary">
              {" "}
              分钟
            </AppText>
          </AppText>
        ) : workout?.distanceTargetKm ? (
          <AppText variant="title" className="text-brand">
            {workout.distanceTargetKm}
            <AppText variant="caption" className="text-secondary">
              {" "}
              公里
            </AppText>
          </AppText>
        ) : null}
        <AppText variant="caption" className="text-secondary">
          公路骑行{intensity ? ` · ${intensity}` : ""}
        </AppText>
      </View>
      {!today ? (
        <AppText variant="caption" className="mt-2 text-secondary">
          今日暂无待执行训练
        </AppText>
      ) : null}
      {data.stageNotice ? (
        <AppText variant="caption" className="mt-2 text-secondary">
          阶段待核对；课程仍为已发布的正式安排。
        </AppText>
      ) : null}
      {changed ? (
        <AppText variant="caption" className="mt-2 text-warning">
          训练版本已变化，请查看最新训练日历。
        </AppText>
      ) : null}
      {detail.error ? (
        <View className="mt-1 flex-row flex-wrap items-center gap-1">
          <AppText variant="caption" className="text-secondary">
            强度详情暂不可用
          </AppText>
          <Button variant="ghost" size="sm" onPress={detail.retry}>
            重试详情
          </Button>
        </View>
      ) : null}
      <Button
        size="lg"
        className="mt-4"
        onPress={() =>
          changed
            ? router.push("/(tabs)/training")
            : router.push({
                pathname: "/workouts/[workoutId]",
                params: { workoutId: next.id },
              })
        }
      >
        {changed ? "查看训练日历" : "查看训练详情"}
      </Button>
      <AppText variant="label" className="mt-2 text-center text-secondary">
        正式计划 v{data.planVersion} · 已生效
      </AppText>
    </Card>
  );
}
