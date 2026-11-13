import { GenerationCancelledError } from "../../../lib/generation-cancelled";
import { useGenerationCancellation } from "../../coach/hooks/useGenerationCancellation";
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
  const cancellation = useGenerationCancellation(token);
  const { track: trackGeneration, reset: resetCancellation } = cancellation;
  const [data, setData] = useState<{
    goal: Awaited<ReturnType<typeof coachApi.goal>>;
    goals: Awaited<ReturnType<typeof coachApi.goals>>;
    goalsError: string | null;
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
  const [stageStartDate, setStageStartDate] = useState("");
  const [stageEndDate, setStageEndDate] = useState("");
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
        coachApi
          .goals(token)
          .then((goals) => ({ goals, goalsError: null as string | null }))
          .catch(() => ({ goals: [], goalsError: "其他目标读取失败" })),
      ])
        .then(([goal, stages, ftp, profile, portfolio]) => {
          if (!active) return;
          const today = localDateInTimezone(new Date(), profile.timezone);
          setData({ goal, stages, ftp, today, ...portfolio });
          setStageStartDate((current) => current || today);
          setStageEndDate((current) => {
            const target = stages?.endDate ?? addDays(today, 83);
            return (
              current ||
              (target < today
                ? addDays(today, 83)
                : target > addDays(today, 364)
                  ? addDays(today, 364)
                  : target)
            );
          });
          setStartDate((current) => current || today);
          setEndDate((current) => current || addDays(today, 27));
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

  const generate = async (
    kind: "STAGES" | "COURSES",
    forceRegenerate = false,
  ) => {
    if (!token || !data || pending.current || !data.ftp) return;
    resetCancellation();
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (data.goalsError) throw new Error("请先重试读取全部目标");
      const planningGoal = data.goals.find(
        (g) => g.status === "ACTIVE" && g.priority === "PRIMARY",
      );
      if (!planningGoal)
        throw new Error("请先在目标管理中确定一个进行中的主目标");
      const planningGoalId = planningGoal.id;
      const rangeStart = kind === "STAGES" ? stageStartDate : startDate;
      const rangeEnd = kind === "STAGES" ? stageEndDate : endDate;
      if (kind === "STAGES" || scope === "DATES") {
        const days =
          (Date.parse(rangeEnd) - Date.parse(rangeStart)) / 86400000 + 1;
        const limit = kind === "STAGES" ? 365 : 84;
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(rangeStart) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(rangeEnd) ||
          !Number.isInteger(days) ||
          days < 1 ||
          days > limit ||
          rangeStart < data.today
        )
          throw new Error(`请选择今天或未来的连续 1–${limit} 天`);
      } else if (!stageId || data.stages?.stale)
        throw new Error("请选择当前有效阶段，阶段过期时请重新生成");
      const signature = JSON.stringify({
        forceRegenerate,
        kind,
        scope,
        stageId,
        startDate: rangeStart,
        endDate: rangeEnd,
        notes,
        goals: data.goals,
      });
      if (request.current?.signature !== signature) {
        const status = await coachApi.planStatus(token);
        const input: StagePlanGeneration | RangeGeneration =
          kind === "STAGES"
            ? {
                goalId: planningGoalId,
                startDate: rangeStart,
                endDate: rangeEnd,
              }
            : scope === "STAGE"
              ? {
                  scope,
                  goalId: planningGoalId,
                  stageId,
                  notes,
                  expectedBaseVersion: status.planVersion,
                }
              : {
                  scope,
                  goalId: planningGoalId,
                  startDate,
                  endDate,
                  notes,
                  expectedBaseVersion: status.planVersion,
                };
        if (forceRegenerate) input.forceRegenerate = true;
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
      trackGeneration(job);
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
      if (
        cause instanceof GenerationCancelledError ||
        (cause instanceof Error && cause.message.startsWith("生成失败（"))
      )
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
    cancellation,
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
    stageStartDate,
    setStageStartDate,
    stageEndDate,
    setStageEndDate,
    notes,
    setNotes,
    generate,
    retry: () => setAttempt((value) => value + 1),
  };
}
