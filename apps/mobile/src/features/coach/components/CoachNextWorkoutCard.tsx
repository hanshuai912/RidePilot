import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { ArrowRight, Bike } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { CoachOverview, ProposalResponse } from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { trainingApi } from "../../training/services/training.api";
import { dateLabel } from "../../training/model/training";
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
        <AppText variant="card">
          {data.planVersion ? "暂无待执行训练" : "尚无正式训练计划"}
        </AppText>
        <AppText variant="body" className="text-secondary">
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
    <Card
      testID="coach-next-workout"
      padding="roomy"
      className="overflow-hidden border-brand-subtle"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-brand-subtle">
            <Bike color={colors.brand} size={18} strokeWidth={1.8} />
          </View>
          <AppText variant="caption" className="font-medium text-brand">
            {today ? "今日训练" : "下一次训练"}
          </AppText>
        </View>
        <AppText variant="caption" className="tabular-nums text-secondary">
          {dateLabel(next.date)}
        </AppText>
      </View>
      <AppText variant="section" className="mt-4">
        {next.title}
      </AppText>
      <View className="mb-3 mt-4 flex-row flex-wrap gap-y-4">
        <View className="min-w-[96px] flex-1 pr-4">
          <AppText variant="label" className="text-secondary">
            {minutes !== null
              ? "计划时长"
              : workout?.distanceTargetKm
                ? "目标距离"
                : "训练目标"}
          </AppText>
          <View className="mt-1 flex-row flex-wrap items-baseline gap-x-1">
            <AppText
              variant={
                minutes !== null || workout?.distanceTargetKm
                  ? "display"
                  : "body"
              }
              className="tabular-nums text-brand"
            >
              {minutes ?? workout?.distanceTargetKm ?? "待补充"}
            </AppText>
            {minutes !== null || workout?.distanceTargetKm ? (
              <AppText variant="caption" className="text-secondary">
                {minutes !== null ? "分钟" : "公里"}
              </AppText>
            ) : null}
          </View>
        </View>
        <View className="min-w-[96px] flex-1 border-l border-border pl-4">
          <AppText variant="label" className="text-secondary">
            工作段强度
          </AppText>
          <AppText variant="card" className="mt-3 tabular-nums">
            {intensity ?? (detail.loading ? "读取中" : "待查看")}
          </AppText>
        </View>
      </View>
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
      <View className="border-t border-divider pt-2">
        <WorkoutDetailLink changed={changed} workoutId={next.id} />
      </View>
    </Card>
  );
}

function WorkoutDetailLink({
  changed,
  workoutId,
}: {
  changed: boolean;
  workoutId: string;
}) {
  const router = useRouter();
  const label = changed ? "查看训练日历" : "查看训练详情";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() =>
        changed
          ? router.push("/(tabs)/training")
          : router.push({
              pathname: "/workouts/[workoutId]",
              params: { workoutId },
            })
      }
      className="min-h-11 flex-row items-center justify-between gap-3 active:opacity-70"
    >
      <AppText variant="body" className="font-medium text-brand">
        {label}
      </AppText>
      <ArrowRight color={colors.brand} size={18} />
    </Pressable>
  );
}
