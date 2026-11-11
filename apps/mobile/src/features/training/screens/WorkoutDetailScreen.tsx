import { useCallback, useRef } from "react";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { Detail } from "../components/Detail";
import { TrainingPage, backToTraining } from "../components/TrainingPage";
import { useTrainingResource } from "../hooks/useTrainingResource";
import { trainingApi } from "../services/training.api";

export function WorkoutDetailScreen() {
  const { workoutId, action, source } = useLocalSearchParams<{
    workoutId: string;
    action?: string;
    source?: string;
  }>();
  const { session } = useAuth();
  // Old links still reach the dedicated action page without mounting detail.
  if (action === "adjust" || action === "feedback")
    return (
      <Redirect
        href={{
          pathname:
            action === "adjust" ? "/workouts/adjust" : "/workouts/feedback",
          params: { workoutId },
        }}
      />
    );
  return (
    <WorkoutDetailContent
      key={`${session?.user.id}-${workoutId}-${source}`}
      workoutId={workoutId}
      token={session?.accessToken}
      historical={source === "history"}
    />
  );
}

function WorkoutDetailContent({
  workoutId,
  token,
  historical,
}: {
  workoutId: string;
  token?: string;
  historical: boolean;
}) {
  const load = useCallback(async () => {
    if (!token || !workoutId) throw new Error("课程不存在或尚未登录");
    return historical
      ? trainingApi.getHistoryWorkout(token, workoutId)
      : trainingApi.getWorkout(token, workoutId);
  }, [token, workoutId, historical]);
  const resource = useTrainingResource(load);
  const focusedBefore = useRef(false);
  const retry = resource.retry;
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) retry();
      focusedBefore.current = true;
    }, [retry]),
  );

  return (
    <TrainingPage
      title="课程详情"
      onBack={
        historical
          ? () => {
              if (router.canGoBack()) router.back();
              else router.replace("/training-history");
            }
          : backToTraining
      }
      loading={resource.loading}
      error={resource.error}
      retry={resource.retry}
    >
      {resource.data ? (
        <Detail
          workout={resource.data}
          feedbackSaved={false}
          readOnly={historical}
          onAdjust={() =>
            router.push({
              pathname: "/workouts/adjust",
              params: { workoutId, source: "detail" },
            })
          }
          onFeedback={() =>
            router.push({
              pathname: "/workouts/feedback",
              params: { workoutId, source: "detail" },
            })
          }
          onEdit={() =>
            router.push({ pathname: "/workouts/editor", params: { workoutId } })
          }
        />
      ) : null}
    </TrainingPage>
  );
}
