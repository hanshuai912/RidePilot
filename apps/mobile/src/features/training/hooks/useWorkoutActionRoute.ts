import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { trainingApi } from "../services/training.api";
import {
  backFromWorkoutAction,
  workoutActionSource,
} from "../model/workout-action-navigation";
import { useTrainingResource } from "./useTrainingResource";

export function useWorkoutActionRoute() {
  const { workoutId = "", source: rawSource } = useLocalSearchParams<{
    workoutId?: string;
    source?: string;
  }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const source = workoutActionSource(rawSource);
  const load = useCallback(async () => {
    if (!token || !workoutId) throw new Error("课程不存在或尚未登录");
    return trainingApi.getWorkout(token, workoutId);
  }, [token, workoutId]);
  const resource = useTrainingResource(load);
  return {
    ...resource,
    token,
    workoutId,
    source,
    back: () => backFromWorkoutAction(source, workoutId),
  };
}
