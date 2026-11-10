import { useGenerationCancellation } from "../../coach/hooks/useGenerationCancellation";
import { goalsApi } from "../../goals/services/goals.api";
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import type { WeekGenerationInput } from "@ridepilot/contracts";
import { coachApi } from "../../coach/services/coach.api";
import { waitForCoachProposal } from "../../coach/services/generation-task";
import { addDays, type Workout } from "../model/training";
import type { WorkoutActionSource } from "../model/workout-action-navigation";

export type AdjustmentReason = NonNullable<WeekGenerationInput["reason"]>;

export function useWorkoutAdjustment(
  token: string | undefined,
  workout: Workout | null,
  source: WorkoutActionSource,
) {
  const cancellation = useGenerationCancellation(token);
  const { track: trackGeneration, reset: resetCancellation } = cancellation;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const generate = async (
    reason: AdjustmentReason,
    notes: string,
    endDate?: string,
  ) => {
    if (!token || !workout || pending.current) return;
    resetCancellation();
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (workout.activity || workout.editable === false)
        throw new Error("当前课程不可调整，请返回刷新计划");
      const goals = await coachApi.goals(token);
      if (!active.current) return;
      const goal =
        goals.find(
          (item) => item.status === "ACTIVE" && item.priority === "PRIMARY",
        ) ?? goals.find((item) => item.status === "ACTIVE");
      if (!goal) throw new Error("请先在 AI 教练中设置训练目标");
      const offset =
        (new Date(`${workout.scheduledDate}T12:00:00`).getDay() + 6) % 7;
      const job = endDate
        ? await goalsApi.generateCourses(
            token,
            {
              scope: "DATES",
              goalId: goal.id,
              startDate: workout.scheduledDate,
              endDate,
              expectedBaseVersion: workout.planVersion,
              notes: `${reason}；${notes.trim()}`.slice(0, 200),
            },
            `adjust-range-${workout.id}-${Date.now()}`,
          )
        : await coachApi.adjustWorkout(
            token,
            workout.id,
            {
              weekStartDate: addDays(workout.scheduledDate, -offset),
              goalId: goal.id,
              mode: "replace_workout",
              expectedBaseVersion: workout.planVersion,
              targetWorkoutId: workout.id,
              reason,
              ...(notes.trim() ? { notes: notes.trim() } : {}),
            },
            `adjust-${workout.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          );
      trackGeneration(job);
      const draft = await waitForCoachProposal(
        token,
        job,
        () => undefined,
        () => active.current,
      );
      if (!draft || !active.current) return;
      setGenerated(true);
      if (endDate) {
        router.push({
          pathname: "/goals/course-preview",
          params: { proposalId: draft.proposalId },
        });
        return;
      }
      router.push({
        pathname: "/workouts/adjustment-preview",
        params: { workoutId: workout.id, proposalId: draft.proposalId, source },
      });
    } catch (cause) {
      if (active.current)
        setError(cause instanceof Error ? cause.message : "生成调整草稿失败");
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  return {
    cancellation,
    busy,
    error,
    generated,
    markChanged: () => setGenerated(false),
    generate,
  };
}
