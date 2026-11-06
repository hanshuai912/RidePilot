import { useCallback, useRef, useState } from "react";
import {
  stageReviewInputSchema,
  type StageReviewEvidence,
  type StageReviewInput,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { CoachApiError } from "../../coach/services/coach.api";
import { useTrainingResource } from "../../training/hooks/useTrainingResource";
import { goalLifecycleApi as api } from "../services/goal-lifecycle.api";

export function useStageReview(stageId: string) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(async () => {
    if (!token) throw new Error("请先登录");
    return api.review(token, stageId);
  }, [token, stageId]);
  const resource = useTrainingResource(load);
  const [criteria, setCriteria] = useState<string | null>(null);
  const [outcome, setOutcome] =
    useState<StageReviewInput["outcome"]>("INSUFFICIENT");
  const [decision, setDecision] =
    useState<StageReviewInput["decision"]>("KEEP");
  const [rationale, setRationale] = useState("");
  const [reviewDirty, setDirty] = useState(false);
  const dirty =
    reviewDirty ||
    (criteria !== null &&
      criteria.trim() !== (resource.data?.snapshot.criteria ?? ""));
  const [preview, setPreview] = useState<{
    input: StageReviewInput;
    key: string;
  } | null>(null);
  const [saved, setSaved] = useState<StageReviewEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [actionError, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    if (!token || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "复评操作失败，请重试");
      if (e instanceof CoachApiError && e.status === 409) {
        setPreview(null);
        setSaved(null);
        resource.retry();
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const edit = (fn: () => void) => {
    fn();
    setDirty(true);
    setPreview(null);
    setSaved(null);
  };
  const saveCriteria = () =>
    run(async () => {
      if (!resource.data) return;
      const text = criteria ?? resource.data.snapshot.criteria ?? "";
      if (!text.trim()) throw new Error("请填写可观察的阶段达成条件");
      await api.criteria(
        token!,
        stageId,
        text.trim(),
        resource.data.snapshot.criteriaVersion,
      );
      setCriteria(null);
      setPreview(null);
      setSaved(null);
      resource.retry();
    });
  const prepare = () =>
    run(async () => {
      if (!resource.data) return;
      if (
        criteria !== null &&
        criteria.trim() !== (resource.data.snapshot.criteria ?? "")
      )
        throw new Error("请先保存修改后的达成条件，再复评");
      const parsed = stageReviewInputSchema.safeParse({
        expectedReviewId: resource.data.history[0]?.id ?? null,
        fingerprint: resource.data.snapshot.fingerprint,
        outcome,
        decision,
        rationale,
      });
      if (!parsed.success)
        throw new Error("请填写复评理由与实际证据（1–500 字）");
      setPreview({
        input: parsed.data,
        key: `stage-review-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
    });
  const confirm = () =>
    run(async () => {
      if (!preview) return;
      const result = await api.saveReview(
        token!,
        stageId,
        preview.input,
        preview.key,
      );
      setSaved(result);
      setPreview(null);
      setDirty(false);
      resource.retry();
    });
  const evidence = saved ?? resource.data?.history[0] ?? null;
  return {
    ...resource,
    token,
    criteria: criteria ?? resource.data?.snapshot.criteria ?? "",
    setCriteria: (v: string) => {
      setCriteria(v);
      setPreview(null);
      setSaved(null);
    },
    outcome,
    setOutcome: (v: StageReviewInput["outcome"]) => edit(() => setOutcome(v)),
    decision,
    setDecision: (v: StageReviewInput["decision"]) =>
      edit(() => setDecision(v)),
    rationale,
    setRationale: (v: string) => edit(() => setRationale(v)),
    dirty,
    preview,
    cancelPreview: () => setPreview(null),
    saved,
    evidence,
    busy,
    actionError,
    saveCriteria,
    prepare,
    confirm,
  };
}
