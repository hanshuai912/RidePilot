import { useCallback, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  cycleReviewGenerationSchema,
  type CycleReviewGeneration,
  type CycleReviewEvidence,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../services/coach.api";
import { useCoachResource } from "../hooks/useCoachResource";
import { cycleReviewApi } from "./cycle-review.api";
import { shiftCycleDate } from "./cycle-review.model";

type Result = {
  review: Awaited<ReturnType<typeof cycleReviewApi.get>>;
  history: Awaited<ReturnType<typeof cycleReviewApi.history>> | null;
  historyError: string | null;
  job: Awaited<ReturnType<typeof coachApi.generation>> | null;
};
const shouldPoll = (data: Result) =>
  data.job
    ? ["QUEUED", "RUNNING"].includes(data.job.status)
    : !!data.history?.items.some((i) =>
        ["QUEUED", "RUNNING"].includes(i.status),
      );

export function useCycleReview() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const router = useRouter();
  const params = useLocalSearchParams<{
    startDate?: string;
    endDate?: string;
    generationId?: string;
  }>();
  const startDate = params.startDate,
    endDate = params.endDate,
    generationId = params.generationId;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [action, setAction] =
    useState<CycleReviewEvidence["action"]>("CONTINUE");
  const [targetStart, setTargetStart] = useState<string | null>(null);
  const [targetEnd, setTargetEnd] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const pending = useRef(false);
  const request = useRef<{
    identity: string;
    input: CycleReviewGeneration;
    key: string;
  } | null>(null);
  const load = useCallback(async (): Promise<Result> => {
    if (!token) throw new Error("请先登录");
    const [review, history, job] = await Promise.all([
      cycleReviewApi.get(
        token,
        startDate || endDate
          ? { startDate: startDate ?? "", endDate: endDate ?? "" }
          : undefined,
      ),
      cycleReviewApi.history(token).then(
        (value) => ({ value, error: null }),
        (error) => ({
          value: null,
          error: error instanceof Error ? error.message : "历史读取失败",
        }),
      ),
      generationId
        ? coachApi.generation(token, generationId)
        : Promise.resolve(null),
    ]);
    return { review, history: history.value, historyError: history.error, job };
  }, [token, startDate, endDate, generationId]);
  const resource = useCoachResource(load, shouldPoll);
  const review = resource.data?.review;
  const defaultStart = review
    ? shiftCycleDate(
        review.localDate > review.endDate ? review.localDate : review.endDate,
        review.localDate > review.endDate ? 0 : 1,
      )
    : "";
  const from = targetStart ?? defaultStart;
  const suggestedEnd = from ? shiftCycleDate(from, 6) : "";
  const to =
    targetEnd ??
    (review?.goal &&
    suggestedEnd > review.goal.targetDate &&
    from <= review.goal.targetDate
      ? review.goal.targetDate
      : suggestedEnd);
  const generate = async (forceRegenerate = false) => {
    if (!token || !review || pending.current) return;
    setActionError(null);
    const parsed = cycleReviewGenerationSchema.safeParse({
      review: {
        startDate: review.startDate,
        endDate: review.endDate,
        fingerprint: review.fingerprint,
        action,
      },
      goalId: review.goal?.id,
      startDate: from,
      endDate: to,
      expectedBaseVersion: review.planVersion,
      notes: notes.trim() || undefined,
      ...(forceRegenerate ? { forceRegenerate: true } : {}),
    });
    if (!parsed.success) {
      setActionError(
        "请补全目标，并填写有效的后续训练起止日期（YYYY-MM-DD）。",
      );
      return;
    }
    if (review.missingFields.length) {
      setActionError("请先补全下方提示的训练资料，再主动生成。");
      return;
    }
    const identity = JSON.stringify(parsed.data);
    if (!request.current || request.current.identity !== identity)
      request.current = {
        identity,
        input: parsed.data,
        key: `cycle-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    pending.current = true;
    setBusy(true);
    try {
      const job = await cycleReviewApi.generate(
        token,
        request.current.input,
        request.current.key,
      );
      // Once accepted, persist only the stable job ID in navigation. Reopening
      // the page and polling never submit another generation request.
      request.current = null;
      router.setParams({ generationId: job.generationId });
      resource.retry();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "生成请求失败，请重试",
      );
      // Keep the same key and input after uncertain network failures.
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const selectRange = (range: { startDate: string; endDate: string }) => {
    router.setParams({ ...range, generationId: "" });
    setActionError(null);
  };
  const preview = (id: string) =>
    router.push({
      pathname: "/(tabs)/coach/suggestion",
      params: {
        id,
        kind: "TRAINING",
        source: "cycle-review",
        startDate: review?.startDate,
        endDate: review?.endDate,
      },
    });
  const resume = (id: string) => {
    const item = resource.data?.history?.items.find(
      (i) => i.generationId === id,
    );
    if (item) {
      setAction(item.review.action);
      setTargetStart(item.startDate);
      setTargetEnd(item.endDate);
      setNotes("");
    }
    router.setParams({
      generationId: id,
      ...(item
        ? { startDate: item.review.startDate, endDate: item.review.endDate }
        : {}),
    });
  };
  return {
    ...resource,
    review,
    busy,
    actionError,
    action,
    setAction,
    from,
    to,
    setTargetStart,
    setTargetEnd,
    notes,
    setNotes,
    generate,
    selectRange,
    preview,
    resume,
    router,
  };
}
