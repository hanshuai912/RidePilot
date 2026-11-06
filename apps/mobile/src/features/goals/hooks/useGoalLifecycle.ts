import { useCallback, useRef, useState } from "react";
import type {
  GoalChange,
  GoalChangePreview,
  GoalEvaluation,
  GoalInput,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi, CoachApiError } from "../../coach/services/coach.api";
import { useTrainingResource } from "../../training/hooks/useTrainingResource";
import { goalLifecycleApi as api } from "../services/goal-lifecycle.api";
import {
  goalFormValue,
  parseGoalForm,
  type GoalFormValue,
} from "../model/goal-lifecycle";

type Preview = {
  change?: GoalChange;
  input: GoalInput | null;
  comparison?: GoalChangePreview;
  evaluation: GoalEvaluation;
  warnings: string[];
  key: string;
};
export function useGoalLifecycle(goalId?: string) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(async () => {
    if (!token) throw new Error("请先登录");
    return goalId ? api.overview(token, goalId) : null;
  }, [token, goalId]);
  const resource = useTrainingResource(load);
  const [formOverride, setFormState] = useState<GoalFormValue | null>(null);
  const form =
    formOverride ??
    (resource.data?.goal.status === "CLOSED"
      ? goalFormValue({
          type: resource.data.goal.type,
          priority: "PRIMARY",
          targetDate: "",
        })
      : goalFormValue(resource.data?.goal));
  const [actionOverride, setActionState] = useState<
    GoalChange["action"] | null
  >(null);
  const action =
    actionOverride ??
    (resource.data?.goal.status === "CLOSED" ? "CREATE_NEXT" : "UPDATE");
  const [reason, setReasonState] = useState("");
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const changeForm = (value: GoalFormValue) => {
    setFormState(value);
    setDirty(true);
    setPreview(null);
  };
  const setAction = (value: GoalChange["action"]) => {
    setActionState(value);
    setPreview(null);
    setDirty(true);
    if (value === "CREATE_NEXT")
      setFormState(
        goalFormValue({
          type: resource.data?.goal.type ?? "FTP",
          priority: "PRIMARY",
          targetDate: "",
        }),
      );
    else if (resource.data) setFormState(goalFormValue(resource.data.goal));
  };
  const setReason = (value: string) => {
    setReasonState(value);
    setDirty(true);
    setPreview(null);
  };
  const run = async (operation: () => Promise<void>) => {
    if (pending.current || !token) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "目标操作失败，请重试");
      if (cause instanceof CoachApiError && cause.status === 409) {
        setPreview(null);
        resource.retry();
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const prepare = () =>
    run(async () => {
      const key = `goal-change-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!goalId) {
        const input = parseGoalForm(form);
        const result = await api.evaluate(token!, input);
        setPreview({ input, ...result, key });
        return;
      }
      if (!resource.data || !reason.trim())
        throw new Error("请填写本次选择的理由或达成证据");
      const change: GoalChange = {
        action,
        expectedVersion: resource.data.goal.version,
        reason: reason.trim(),
        ...(["UPDATE", "RESUME"].includes(action)
          ? { changes: parseGoalForm(form) }
          : {}),
        ...(action === "CREATE_NEXT" ? { nextGoal: parseGoalForm(form) } : {}),
      };
      const comparison = await api.preview(token!, goalId, change);
      setPreview({
        change,
        comparison,
        input: null,
        evaluation: comparison.evaluation,
        warnings: comparison.warnings,
        key,
      });
    });
  const confirm = () =>
    run(async () => {
      if (!preview) return;
      if (!goalId && preview.input) {
        const result = await coachApi.createGoal(
          token!,
          preview.input,
          preview.key,
        );
        setSavedId(result.id);
      } else if (goalId && preview.change && preview.comparison) {
        const result = await api.apply(
          token!,
          goalId,
          preview.change,
          preview.comparison.fingerprint,
          preview.key,
        );
        setSavedId(result.nextGoal?.id ?? result.goal.id);
      }
      setDirty(false);
    });
  return {
    ...resource,
    form,
    changeForm,
    action,
    setAction,
    reason,
    setReason,
    dirty: dirty && !savedId,
    preview,
    cancelPreview: () => setPreview(null),
    busy,
    actionError: error,
    savedId,
    prepare,
    confirm,
  };
}
