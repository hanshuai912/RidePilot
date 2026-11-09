import { useRef, useState } from "react";
import type { ProposalResponse, ReschedulePreview } from "@ridepilot/contracts";
import { trainingApi } from "../services/training.api";
import { isTrainingDate, type Workout } from "../model/training";

export function useWorkoutReschedule(
  token: string | undefined,
  workout: Workout | null,
) {
  const [preview, setPreview] = useState<ReschedulePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [applied, setApplied] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ proposal: ProposalResponse; key: string } | null>(
    null,
  );
  const check = async (date: string) => {
    if (!token || !workout || pending.current || locked) return;
    if (!isTrainingDate(date)) {
      setError("请输入有效日期 YYYY-MM-DD");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(
        await trainingApi.reschedulePreview(token, workout.id, {
          scheduledDate: date,
          expectedPlanVersion: workout.planVersion,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "改期检查失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const apply = async () => {
    if (
      !token ||
      !workout ||
      !preview ||
      preview.conflicts.length ||
      pending.current ||
      applied
    )
      return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!attempt.current) {
        const proposal = await trainingApi.createEdit(token, workout.id, {
          scheduledDate: preview.to,
          expectedPlanVersion: preview.planVersion,
          title: workout.title,
          purpose: workout.purpose,
          segments: workout.segments,
        });
        const validated = await trainingApi.validate(
          token,
          proposal.proposalId,
        );
        if (
          validated.status !== "READY" ||
          validated.validation.blockers.length ||
          validated.proposalVersion !== proposal.proposalVersion
        )
          throw new Error(
            validated.validation.blockers.join("；") ||
              "草稿已变化，请重新检查改期",
          );
        attempt.current = {
          proposal: validated,
          key: `reschedule-${validated.proposalId}`,
        };
      }
      setLocked(true);
      const { proposal, key } = attempt.current;
      await trainingApi.apply(
        token,
        proposal.proposalId,
        proposal.basePlanVersion,
        key,
        proposal.proposalVersion,
      );
      setApplied(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "改期失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    preview,
    error,
    busy,
    locked,
    applied,
    check,
    apply,
    clear: () => {
      if (!locked) {
        setPreview(null);
        setError(null);
      }
    },
  };
}
