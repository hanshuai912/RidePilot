import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type {
  GoalChange,
  GoalChangePreview,
  GoalEvaluation,
  GoalInput,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi, CoachApiError } from "../../coach/services/coach.api";
import { useTrainingResource } from "../../training/hooks/useTrainingResource";
import { getProfile } from "../../profile/services/profile.api";
import { localDateInTimezone } from "../../coach/model/plan-dates";
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
    const goals = await coachApi.goals(token);
    if (goalId) {
      const overview = await api.overview(token, goalId);
      return { overview, goals, today: overview.evaluation.localDate };
    }
    const profile = await getProfile(token);
    return {
      overview: null,
      goals,
      today: localDateInTimezone(new Date(), profile.timezone),
    };
  }, [token, goalId]);
  const resource = useTrainingResource(load);
  const retry = resource.retry;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else retry();
    }, [retry]),
  );
  const data = resource.data?.overview ?? null;
  const otherActiveGoals = (resource.data?.goals ?? []).filter(
    (goal) => goal.id !== goalId && goal.status === "ACTIVE",
  );
  const creating = !goalId || data?.goal.status === "CLOSED";
  const newPriority = otherActiveGoals.some(
    (goal) => goal.priority === "PRIMARY",
  )
    ? "SECONDARY"
    : "PRIMARY";
  const [formOverride, setFormState] = useState<GoalFormValue | null>(null);
  const form =
    formOverride ??
    (data?.goal.status === "CLOSED"
      ? goalFormValue({
          type: data.goal.type,
          priority: newPriority,
          targetDate: "",
        })
      : goalFormValue(
          data?.goal ?? { type: "FTP", priority: newPriority, targetDate: "" },
        ));
  const [actionOverride, setActionState] = useState<
    GoalChange["action"] | null
  >(null);
  const action =
    actionOverride ??
    (data?.goal.status === "CLOSED" ? "CREATE_NEXT" : "UPDATE");
  const effectiveForm = creating
    ? { ...form, priority: newPriority as GoalInput["priority"] }
    : otherActiveGoals.length === 0 &&
        (data?.goal.status === "ACTIVE" || action === "RESUME")
      ? { ...form, priority: "PRIMARY" as const }
      : form;
  const [reason, setReasonState] = useState("");
  const [completionCriteriaOverride, setCompletionCriteria] = useState<
    string | null
  >(null);
  const completionCriteria =
    completionCriteriaOverride ?? data?.goal.successCriteria ?? "";
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
          type: data?.goal.type ?? "FTP",
          priority: newPriority,
          targetDate: "",
        }),
      );
    else if (data) setFormState(goalFormValue(data.goal));
  };
  const setReason = (value: string) => {
    setReasonState(value);
    setDirty(true);
    setPreview(null);
  };
  const changeCompletionCriteria = (value: string) => {
    setCompletionCriteria(value);
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
        const input = parseGoalForm(effectiveForm);
        const result = await api.evaluate(token!, input);
        setPreview({ input, ...result, key });
        return;
      }
      if (action === "COMPLETE" && !completionCriteria.trim())
        throw new Error("请填写达成条件");
      if (!data || !reason.trim())
        throw new Error("请填写本次选择的理由或达成证据");
      const change: GoalChange = {
        action,
        expectedVersion: data.goal.version,
        reason: reason.trim(),
        ...(["UPDATE", "RESUME"].includes(action)
          ? { changes: parseGoalForm(effectiveForm) }
          : {}),
        ...(action === "COMPLETE"
          ? { changes: { successCriteria: completionCriteria.trim() } }
          : {}),
        ...(action === "CREATE_NEXT"
          ? { nextGoal: parseGoalForm(effectiveForm) }
          : {}),
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
    data,
    today: resource.data?.today ?? "",
    form: effectiveForm,
    showPriority: otherActiveGoals.length > 0,
    canPromote:
      !creating &&
      data?.goal.priority === "SECONDARY" &&
      otherActiveGoals.length > 0,
    changeForm,
    action,
    setAction,
    reason,
    setReason,
    completionCriteria,
    changeCompletionCriteria,
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
