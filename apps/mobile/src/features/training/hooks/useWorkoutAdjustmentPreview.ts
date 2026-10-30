import { useCallback, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { trainingApi } from "../services/training.api";
import { useTrainingResource } from "./useTrainingResource";

export function useWorkoutAdjustmentPreview() {
  const { workoutId = "", proposalId = "" } = useLocalSearchParams<{
    workoutId?: string;
    proposalId?: string;
  }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(async () => {
    if (!token || !workoutId || !proposalId)
      throw new Error("调整草稿不存在或尚未登录");
    const [workout, proposal] = await Promise.all([
      trainingApi.getWorkout(token, workoutId),
      coachApi.proposal(token, proposalId),
    ]);
    if (
      proposal.scene !== "WORKOUT_ADJUST" ||
      !proposal.replaceWorkoutIds.includes(workoutId)
    )
      throw new Error("调整草稿与当前课程不匹配，请返回重新生成");
    return { workout, proposal };
  }, [token, workoutId, proposalId]);
  const resource = useTrainingResource(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedDate, setAppliedDate] = useState<string | null>(null);
  const pending = useRef(false);
  const applyAttempt = useRef<{ id: string; key: string } | null>(null);
  const apply = async () => {
    if (!token || !resource.data || pending.current || appliedDate) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const { workout, proposal } = resource.data;
    try {
      if (applyAttempt.current?.id !== proposal.proposalId) {
        const validated = await coachApi.validate(token, proposal.proposalId);
        if (validated.status !== "READY" || validated.blockers.length)
          throw new Error(
            validated.blockers[0] ?? "草稿未通过校验，请返回修改",
          );
        applyAttempt.current = {
          id: proposal.proposalId,
          key: `apply-adjustment-${proposal.proposalId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      }
      // Preserve the same request after an uncertain response, including its
      // idempotency key; do not validate an already-applied proposal again.
      const applied = await coachApi.apply(
        token,
        proposal.proposalId,
        proposal.basePlanVersion,
        applyAttempt.current.key,
      );
      setAppliedDate(applied.affectedDates[0] ?? workout.scheduledDate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "应用调整失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    ...resource,
    busy,
    error: resource.error,
    actionError: error,
    appliedDate,
    apply,
  };
}
