import { router, type Href } from "expo-router";

export type WorkoutActionSource = "home" | "detail" | "training";

export function workoutActionSource(value?: string): WorkoutActionSource {
  return value === "home" || value === "detail" ? value : "training";
}

export function workoutActionDestination(
  source: WorkoutActionSource,
  workoutId: string,
  options: { applied?: boolean; date?: string; saved?: boolean } = {},
): Href {
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
