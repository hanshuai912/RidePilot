import { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { Detail } from "../components/Detail";
import { TrainingPage } from "../components/TrainingPage";
import { useTrainingResource } from "../hooks/useTrainingResource";
import { trainingApi } from "../services/training.api";

export function WorkoutDetailScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(async () => {
    if (!token || !workoutId) throw new Error("课程不存在或尚未登录");
    return trainingApi.getWorkout(token, workoutId);
  }, [token, workoutId]);
  const resource = useTrainingResource(load);
  return (
    <TrainingPage
      loading={resource.loading}
      error={resource.error}
      retry={resource.retry}
    >
      {resource.data ? (
        <Detail
          workout={resource.data}
          onEdit={() =>
            router.push({ pathname: "/workouts/editor", params: { workoutId } })
          }
        />
      ) : null}
    </TrainingPage>
  );
}
