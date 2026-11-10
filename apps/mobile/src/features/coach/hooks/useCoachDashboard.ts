import { useCallback } from "react";
import type { CoachSuggestions } from "@ridepilot/contracts";
import { trainingApi } from "../../training/services/training.api";
import { coachCenterApi } from "../services/coach-center.api";
import { useCoachResource } from "./useCoachResource";

const shouldPoll = (data: CoachSuggestions | null) =>
  data?.pending.some((item) => item.kind === "GENERATION") ?? false;

// Coordinate the home reads before rendering modules. Keep suggestions separate
// so retries and job polling do not refetch the overview or hide loaded content.
export function useCoachDashboard({
  token,
  enabled,
  hasActivePlan,
}: {
  token?: string;
  enabled: boolean;
  hasActivePlan: boolean;
}) {
  const overviewEnabled = enabled && hasActivePlan && !!token;
  const loadOverview = useCallback(async () => {
    if (!token || !enabled || !hasActivePlan) return null;
    const overview = await coachCenterApi.overview(token);
    let workout: Awaited<ReturnType<typeof trainingApi.getWorkout>> | null =
      null;
    let workoutError: string | null = null;
    if (overview.nextWorkout) {
      try {
        workout = await trainingApi.getWorkout(token, overview.nextWorkout.id);
      } catch (cause) {
        workoutError =
          cause instanceof Error ? cause.message : "课程详情读取失败";
      }
    }
    return { overview, workout, workoutError };
  }, [token, enabled, hasActivePlan]);
  const loadSuggestions = useCallback(
    () =>
      token && enabled
        ? coachCenterApi.suggestions(token)
        : Promise.resolve(null),
    [token, enabled],
  );
  const overview = useCoachResource(loadOverview);
  const suggestions = useCoachResource(loadSuggestions, shouldPoll);
  // Also cover the render before a newly enabled focus effect starts its read.
  const overviewLoading =
    overviewEnabled &&
    (overview.loading || (!overview.data && !overview.error));
  const suggestionsLoading =
    enabled &&
    !!token &&
    (suggestions.loading || (!suggestions.data && !suggestions.error));
  return {
    loading: overviewLoading || suggestionsLoading,
    overview: {
      data: overview.data?.overview ?? null,
      loading: overviewLoading,
      error: overview.error,
      retry: overview.retry,
    },
    detail: {
      data: overview.data?.workout ?? null,
      loading: overviewLoading,
      error: overview.data?.workoutError ?? null,
      retry: overview.retry,
    },
    suggestions,
  };
}
