import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import type {
  RangeGeneration,
  StagePlanGeneration,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi, CoachApiError } from "../../coach/services/coach.api";
import { addDays, localDateInTimezone } from "../../coach/model/plan-dates";
import { getProfile } from "../../profile/services/profile.api";
import { goalsApi } from "../services/goals.api";
import { waitForGeneration } from "../services/wait-for-generation";

export function useGoalPlanning(goalId: string) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [data, setData] = useState<{
    goal: Awaited<ReturnType<typeof coachApi.goal>>;
    stages: Awaited<ReturnType<typeof goalsApi.activeStages>>;
    ftp: Awaited<ReturnType<typeof coachApi.ftp>>;
    today: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState<"STAGE" | "DATES">("DATES");
  const [stageId, setStageId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const request = useRef<{
    kind: "STAGES" | "COURSES";
    signature: string;
    key: string;
    input: StagePlanGeneration | RangeGeneration;
    jobId?: string;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      let active = true;
      if (!token) {
        setError("请先登录");
        setLoading(false);
        return;
      }
      setLoading(true);
      Promise.all([
        coachApi.goal(token, goalId),
        goalsApi.activeStages(token, goalId),
        coachApi.ftp(token),
        getProfile(token),
      ])
        .then(([goal, stages, ftp, profile]) => {
          if (!active) return;
          const today = localDateInTimezone(new Date(), profile.timezone);
          setData({ goal, stages, ftp, today });
          setStartDate((current) => current || today);
          setEndDate(
            (current) =>
              current ||
              (goal.targetDate < today
                ? today
                : goal.targetDate < addDays(today, 27)
                  ? goal.targetDate
                  : addDays(today, 27)),
          );
          setError(null);
        })
        .catch((cause: unknown) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "目标读取失败");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [token, goalId, attempt]),
  );

  const generate = async (kind: "STAGES" | "COURSES") => {
    if (!token || !data || pending.current || !data.ftp) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (data.goal.status !== "ACTIVE") throw new Error("请选择活跃目标");
      if (kind === "STAGES" || scope === "DATES") {
        const days =
          (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1;
        const limit = kind === "STAGES" ? 365 : 84;
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
          !Number.isInteger(days) ||
          days < 1 ||
          days > limit ||
          startDate < data.today
        )
          throw new Error(`请选择今天或未来的连续 1–${limit} 天`);
      } else if (!stageId || data.stages?.stale)
        throw new Error("请选择当前有效阶段，阶段过期时请重新生成");
      const signature = JSON.stringify({
        kind,
        scope,
        stageId,
        startDate,
        endDate,
        notes,
      });
      if (request.current?.signature !== signature) {
        const status = await coachApi.planStatus(token);
        const input: StagePlanGeneration | RangeGeneration =
          kind === "STAGES"
            ? { goalId, startDate, endDate }
            : scope === "STAGE"
              ? {
                  scope,
                  goalId,
                  stageId,
                  notes,
                  expectedBaseVersion: status.planVersion,
                }
              : {
                  scope,
                  goalId,
                  startDate,
                  endDate,
                  notes,
                  expectedBaseVersion: status.planVersion,
                };
        request.current = {
          kind,
          signature,
          input,
          key: `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      }
      const saved = request.current;
      const job = saved.jobId
        ? await coachApi.generation(token, saved.jobId)
        : kind === "STAGES"
          ? await goalsApi.generateStages(
              token,
              saved.input as StagePlanGeneration,
              saved.key,
            )
          : await goalsApi.generateCourses(
              token,
              saved.input as RangeGeneration,
              saved.key,
            );
      saved.jobId = job.generationId;
      const id = await waitForGeneration(token, job, () => mounted.current);
      if (id && mounted.current) {
        request.current = null;
        router.push({
          pathname:
            kind === "STAGES"
              ? "/goals/stage-preview"
              : "/goals/course-preview",
          params: { proposalId: id, goalId },
        });
      }
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : "生成失败，请重试");
      // Completed failures can be submitted again. Uncertain network responses
      // and timeouts retain the same request and key for safe resumption.
      if (cause instanceof Error && cause.message.startsWith("生成失败（"))
        request.current = null;
      if (
        cause instanceof CoachApiError &&
        (cause.status === 400 || cause.status === 409)
      )
        request.current = null;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return {
    data,
    loading,
    error,
    busy,
    scope,
    setScope,
    stageId,
    setStageId,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    notes,
    setNotes,
    generate,
    retry: () => setAttempt((value) => value + 1),
  };
}
