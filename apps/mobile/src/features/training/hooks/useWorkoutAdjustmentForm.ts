import { useEffect, useState } from "react";
import type { AdjustmentReason } from "./useWorkoutAdjustment";
import { addDays, isTrainingDate } from "../model/training";
export type WorkoutAdjustmentScopeValue = "SINGLE" | "FUTURE";

export type SubmitWorkoutAdjustment = (
  reason: AdjustmentReason,
  notes: string,
  endDate?: string,
) => void;

export function useWorkoutAdjustmentForm(
  scheduledDate: string | undefined,
  onDirtyChange: (dirty: boolean) => void,
  onChange: () => void,
) {
  const [reason, setReason] = useState<AdjustmentReason>("TIME_SHORT");
  const [scope, setScope] = useState<WorkoutAdjustmentScopeValue>("SINGLE");
  const [chosenEndDate, setChosenEndDate] = useState<{
    scheduledDate: string;
    value: string;
  } | null>(null);
  const endDate = scheduledDate
    ? chosenEndDate?.scheduledDate === scheduledDate
      ? chosenEndDate.value
      : addDays(scheduledDate, 6)
    : "";
  const [confirm, setConfirm] = useState(false);
  const [notes, setNotes] = useState("");
  const validRange =
    !!scheduledDate &&
    isTrainingDate(endDate) &&
    endDate >= scheduledDate &&
    endDate <= addDays(scheduledDate, 83);
  const canSubmit = !!scheduledDate && (scope === "SINGLE" || validRange);
  useEffect(() => {
    onDirtyChange(
      reason !== "TIME_SHORT" || notes !== "" || scope !== "SINGLE",
    );
  }, [reason, notes, scope, onDirtyChange]);
  return {
    reason,
    scope,
    endDate,
    notes,
    confirm,
    validRange,
    canSubmit,
    scheduledDate: scheduledDate ?? "",
    setReason: (value: AdjustmentReason) => {
      setReason(value);
      onChange();
    },
    setScope: (value: WorkoutAdjustmentScopeValue) => {
      setScope(value);
      onChange();
    },
    setEndDate: (value: string) => {
      setChosenEndDate({ scheduledDate: scheduledDate ?? "", value });
      onChange();
    },
    setNotes: (value: string) => {
      setNotes(value);
      onChange();
    },
    closeConfirmation: () => setConfirm(false),
    requestSubmit: (submit: SubmitWorkoutAdjustment) => {
      if (!canSubmit) return;
      if (scope === "FUTURE") setConfirm(true);
      else submit(reason, notes);
    },
    confirmSubmit: (submit: SubmitWorkoutAdjustment) => {
      if (!canSubmit || !confirm) return;
      setConfirm(false);
      submit(reason, notes, endDate);
    },
  };
}
export type WorkoutAdjustmentFormState = ReturnType<
  typeof useWorkoutAdjustmentForm
>;
