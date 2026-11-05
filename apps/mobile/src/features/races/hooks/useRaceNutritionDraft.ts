import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { NutritionProposalResponse } from "@ridepilot/contracts";
import {
  NutritionGenerationFailedError,
  waitForNutritionProposal,
} from "../../nutrition/services/generation-task";
import { createRaceNutritionDraft } from "../services/race-nutrition-draft";

const WAIT_TIMEOUT_MS = 180_000;
type Run = { active: boolean; timeout: ReturnType<typeof setTimeout> };
type Task = {
  raceId: string;
  promise: ReturnType<typeof createRaceNutritionDraft>;
};

export function useRaceNutritionDraft(raceId: string, token?: string) {
  const [proposal, setProposal] = useState<NutritionProposalResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<"READING" | "QUEUED" | "RUNNING">(
    "READING",
  );
  const run = useRef<Run | null>(null);
  const task = useRef<Task | null>(null);
  const forceRequested = useRef(false);
  const scope = useRef(raceId);

  const stop = useCallback(() => {
    if (!run.current) return;
    run.current.active = false;
    clearTimeout(run.current.timeout);
    run.current = null;
  }, []);

  const start = useCallback(
    (regenerate = false) => {
      stop();
      if (scope.current !== raceId) {
        scope.current = raceId;
        forceRequested.current = false;
        task.current = null;
      }
      if (regenerate) {
        forceRequested.current = true;
        task.current = null;
      }
      setProposal(null);
      setError(null);
      if (!token || !raceId) {
        setGenerating(false);
        setError(
          !raceId
            ? "缺少赛事信息，请返回赛事详情重新进入"
            : "登录状态已失效，请重新登录",
        );
        return;
      }
      setGenerating(true);
      setStatus("READING");
      const current: Run = {
        active: true,
        timeout: setTimeout(() => {
          current.active = false;
          setGenerating(false);
          setError("补给草稿等待超时，可重试继续查询；正式饮食计划没有变化");
        }, WAIT_TIMEOUT_MS),
      };
      run.current = current;
      const isActive = () => current.active && run.current === current;
      // Keep the submission promise through focus and token changes, including
      // navigation away before POST returns. Resuming must not enqueue another job.
      if (!task.current || task.current.raceId !== raceId) {
        task.current = {
          raceId,
          promise: createRaceNutritionDraft(
            token,
            raceId,
            forceRequested.current,
          ),
        };
      }
      const pending = task.current;
      void (async () => {
        let submitted = false;
        try {
          const initial = await pending.promise;
          submitted = true;
          if (!isActive()) return;
          if (initial.proposal) {
            setProposal(initial.proposal);
            return;
          }
          if (!initial.generation)
            throw new NutritionGenerationFailedError(
              "未找到赛事补给任务，请重试",
            );
          const next = await waitForNutritionProposal(
            token,
            initial.generation,
            (nextStatus) => {
              if (isActive()) setStatus(nextStatus);
            },
            isActive,
          );
          if (isActive() && next) setProposal(next);
        } catch (cause) {
          if (!isActive()) return;
          // Only rejected submissions and terminal failures need a new job.
          // Polling/network timeouts must resume the already submitted task.
          if (
            task.current === pending &&
            (!submitted || cause instanceof NutritionGenerationFailedError)
          )
            task.current = null;
          setError(
            cause instanceof Error
              ? cause.message
              : "赛事补给草稿生成失败，请重试",
          );
        } finally {
          clearTimeout(current.timeout);
          if (isActive()) setGenerating(false);
        }
      })();
    },
    [raceId, token, stop],
  );

  useFocusEffect(
    useCallback(() => {
      start();
      return stop;
    }, [start, stop]),
  );

  return {
    proposal,
    setProposal,
    error,
    setError,
    generating,
    status,
    retry: () => start(),
    regenerate: () => start(true),
  };
}
