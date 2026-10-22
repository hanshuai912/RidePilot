import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { trainingApi } from "../services/training.api";
import { saveManualWorkout } from "../services/save-manual-workout";
import { useTrainingDraftRoute } from "./useTrainingDraftRoute";
import { useTrainingResource } from "./useTrainingResource";

export function useWorkoutEditor() {
  const {
    workoutId,
    proposalId,
    draftId: localId,
  } = useLocalSearchParams<{
    workoutId?: string;
    proposalId?: string;
    draftId?: string;
  }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const route = useTrainingDraftRoute();
  const draftId =
    localId ?? (workoutId ? `workout-${workoutId}` : route.draftId);
  const { edit } = route;
  const load = useCallback(async () => {
    if (!workoutId || proposalId || route.entry) return null;
    if (!token) throw new Error("请先登录后编辑课程");
    const workout = await trainingApi.getWorkout(token, workoutId);
    const calendar = await trainingApi.getCalendar(
      token,
      workout.scheduledDate,
      workout.scheduledDate,
    );
    return { workout, hasFtp: calendar.ftpAvailable };
  }, [workoutId, proposalId, route.entry, token]);
  const resource = useTrainingResource(load);
  useEffect(() => {
    if (!resource.data) return;
    const id = edit(resource.data.workout, resource.data.hasFtp);
    router.setParams({ draftId: id });
  }, [resource.data, edit]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const pending = useRef(false);
  const save = async () => {
    if (!route.entry || !token || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      await saveManualWorkout(token, route.entry, (proposal) => {
        route.saved(draftId, proposal);
        router.setParams({ proposalId: proposal.proposalId });
      });
      route.remove(draftId);
      router.dismissTo({
        pathname: "/(tabs)/training",
        params: { savedAt: String(Date.now()) },
      });
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "保存课程失败，请重试",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    ...route,
    draftId,
    busy,
    feedback,
    save,
    loading:
      !route.entry &&
      (workoutId && !proposalId ? resource.loading : route.loading),
    error: route.entry
      ? null
      : workoutId && !proposalId
        ? resource.error
        : route.error,
    retry: workoutId && !proposalId ? resource.retry : route.retry,
  };
}
