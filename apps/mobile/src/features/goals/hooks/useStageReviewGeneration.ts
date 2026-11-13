import { GenerationCancelledError } from "../../../lib/generation-cancelled";
import { useGenerationCancellation } from "../../coach/hooks/useGenerationCancellation";
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { z } from "zod";
import {
  rangeGenerationSchema,
  stagePlanGenerationSchema,
  type RangeGeneration,
  type StagePlanGeneration,
  type StageReviewEvidence,
} from "@ridepilot/contracts";
import { coachApi, CoachApiError } from "../../coach/services/coach.api";
import { addDays } from "../../coach/model/plan-dates";
import { goalsApi } from "../services/goals.api";
import { waitForGeneration } from "../services/wait-for-generation";

export function useStageReviewGeneration(
  token: string | undefined,
  evidence: StageReviewEvidence | null,
) {
  const cancellation = useGenerationCancellation(token);
  const { track: trackGeneration, reset: resetCancellation } = cancellation;
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const request = useRef<{
    signature: string;
    key: string;
    input: RangeGeneration | StagePlanGeneration;
    jobId?: string;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const generate = async (roadmap: boolean) => {
    if (!token || !evidence || pending.current) return;
    resetCancellation();
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const s = evidence.snapshot;
      const start = startDate || s.localDate;
      const end = endDate || addDays(start, 27);
      const signature = JSON.stringify({
        id: evidence.id,
        roadmap,
        start,
        end,
      });
      if (request.current?.signature !== signature) {
        const common = { goalId: s.goalId, stageReviewId: evidence.id };
        const status = roadmap ? null : await coachApi.planStatus(token);
        const input = roadmap
          ? stagePlanGenerationSchema.parse({
              ...common,
              startDate: start,
              endDate: end,
            })
          : rangeGenerationSchema.parse(
              evidence.decision === "ADJUST"
                ? {
                    ...common,
                    scope: "DATES",
                    startDate: start,
                    endDate: end,
                    expectedBaseVersion: status!.planVersion,
                  }
                : {
                    ...common,
                    scope: "STAGE",
                    stageId:
                      evidence.decision === "NEXT"
                        ? s.nextStage?.id
                        : s.stageId,
                    expectedBaseVersion: status!.planVersion,
                  },
            );
        request.current = {
          signature,
          input,
          key: `stage-followup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      }
      const req = request.current;
      const job = req.jobId
        ? await coachApi.generation(token, req.jobId)
        : roadmap
          ? await goalsApi.generateStages(
              token,
              req.input as StagePlanGeneration,
              req.key,
            )
          : await goalsApi.generateCourses(
              token,
              req.input as RangeGeneration,
              req.key,
            );
      trackGeneration(job);
      req.jobId = job.generationId;
      const id = await waitForGeneration(token, job, () => mounted.current);
      if (id && mounted.current)
        router.push({
          pathname: roadmap ? "/goals/stage-preview" : "/goals/course-preview",
          params: { proposalId: id, goalId: s.goalId },
        });
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof z.ZodError
            ? "请选择有效的开始和结束日期"
            : e instanceof Error
              ? e.message
              : "草稿生成失败，请重试",
        );
      if (
        (e instanceof CoachApiError &&
          e.status !== null &&
          [400, 409].includes(e.status)) ||
        e instanceof GenerationCancelledError ||
        (e instanceof Error && e.message.startsWith("生成失败（"))
      )
        request.current = null;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const resume = async (id: string, roadmap: boolean) => {
    if (!token || !evidence || pending.current) return;
    resetCancellation();
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const job = await coachApi.generation(token, id);
      trackGeneration(job);
      const proposalId = await waitForGeneration(
        token,
        job,
        () => mounted.current,
      );
      if (proposalId && mounted.current)
        router.push({
          pathname: roadmap ? "/goals/stage-preview" : "/goals/course-preview",
          params: { proposalId, goalId: evidence.snapshot.goalId },
        });
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "查询任务失败，请重试");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return {
    cancellation,
    resume,
    startDate: startDate || evidence?.snapshot.localDate || "",
    endDate:
      endDate ||
      (evidence ? addDays(startDate || evidence.snapshot.localDate, 27) : ""),
    setStartDate,
    setEndDate,
    busy,
    error,
    generate,
  };
}
