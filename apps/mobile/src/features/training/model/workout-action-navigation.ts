import { router, type Href } from "expo-router";

export type WorkoutActionSource =
  "home" | "detail" | "training" | "cycle-review";

export function workoutActionSource(value?: string): WorkoutActionSource {
  return value === "home" || value === "detail" || value === "cycle-review"
    ? value
    : "training";
}

export function workoutActionDestination(
  source: WorkoutActionSource,
  workoutId: string,
  options: {
    applied?: boolean;
    date?: string;
    saved?: boolean;
    reviewStartDate?: string;
    reviewEndDate?: string;
  } = {},
): Href {
  if (source === "cycle-review")
    return {
      pathname: "/(tabs)/coach/cycle-review",
      params: {
        ...(options.reviewStartDate
          ? { startDate: options.reviewStartDate }
          : {}),
        ...(options.reviewEndDate ? { endDate: options.reviewEndDate } : {}),
      },
    };
  if (source === "home") return "/(tabs)";
  if (source === "detail" && !options.applied)
    return { pathname: "/workouts/[workoutId]", params: { workoutId } };
  return {
    pathname: "/(tabs)/training",
    params: {
      ...(options.date ? { date: options.date } : {}),
      ...(options.saved ? { savedAt: String(Date.now()) } : {}),
    },
  };
}

export function backFromWorkoutAction(
  source: WorkoutActionSource,
  workoutId: string,
) {
  if (router.canGoBack()) router.back();
  else router.replace(workoutActionDestination(source, workoutId));
}
