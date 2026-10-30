import { useRef, useState } from "react";
import { activityInputSchema, type ActivityInput } from "@ridepilot/contracts";
import { coachApi } from "../../coach/services/coach.api";
import type { Workout } from "../model/training";

export type WorkoutFeedbackInput = Omit<
  ActivityInput,
  "workoutId" | "localDate"
>;

export function useWorkoutFeedback(
  token: string | undefined,
  workout: Workout | null,
  onSaved: () => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const save = async (input: WorkoutFeedbackInput) => {
    if (!token || !workout || pending.current || workout.activity) return;
    const parsed = activityInputSchema.safeParse({
      workoutId: workout.id,
      localDate: workout.scheduledDate,
      ...input,
      notes: input.notes?.trim() || null,
    });
    if (!parsed.success) {
      setError("请检查实际时长（0–1440 分钟）及 RPE、疲劳（1–10 的整数）");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await coachApi.recordActivity(token, parsed.data);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存训练反馈失败");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { busy, error, save };
}
