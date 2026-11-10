import { useGenerationCancellation } from "../../coach/hooks/useGenerationCancellation";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  readinessSchema,
  type AiProposalResponse,
  type RacePlanningPhase,
} from "@ridepilot/contracts";
import { coachApi, CoachApiError } from "../../coach/services/coach.api";
import { waitForCoachProposal } from "../../coach/services/generation-task";

type MissingFields = ReturnType<typeof readinessSchema.parse>["missingFields"];
const key = () => `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useRaceTrainingDraft(
  token: string | undefined,
  raceId: string,
  recovery: boolean,
  requestedPhase?: RacePlanningPhase,
) {
  const phaseRequest = requestedPhase ?? (recovery ? "RECOVERY" : undefined);
  const cancellation = useGenerationCancellation(token);
  const { track: trackGeneration, reset: resetCancellation } = cancellation;
  const [proposal, setProposal] = useState<AiProposalResponse | null>(null);
  const [missingFields, setMissingFields] = useState<MissingFields>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<RacePlanningPhase>(
    phaseRequest ?? "PREPARATION",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [impact, setImpact] = useState<Awaited<
    ReturnType<typeof coachApi.raceImpact>
  > | null>(null);
  const selection = useRef<{
    scope: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const operation = useRef(0);
  const waitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const scope = `${raceId}:${phaseRequest ?? "default"}`;
  const run = useCallback(
    async (generate: boolean, forceRegenerate = false) => {
      if (!token || !raceId || running.current) return;
      resetCancellation();
      const attempt = ++operation.current;
      const active = () => operation.current === attempt;
      running.current = true;
      setError(null);
      setBusy(true);
      const timeout = setTimeout(() => {
        if (!active()) return;
        operation.current += 1;
        running.current = false;
        setBusy(false);
        setError("赛事训练等待超时，可重新查询已有任务；正式计划没有变化");
      }, 180_000);
      waitTimeout.current = timeout;
      try {
        const [state, goals, plan, readiness, race] = await Promise.all([
          coachApi.raceTrainingState(token, raceId, phaseRequest),
          coachApi.goals(token),
          coachApi.planStatus(token),
          coachApi.readiness(token),
          coachApi.race(token, raceId),
        ]);
        if (!active()) return;
        const selectionScope = `${scope}:${state.phase}:${race.version}`;
        const range =
          selection.current?.scope === selectionScope &&
          selection.current.startDate >= state.today
            ? selection.current
            : {
                scope: selectionScope,
                startDate: state.startDate,
                endDate: state.endDate,
              };
        selection.current = range;
        setStartDate(range.startDate);
        setEndDate(range.endDate);
        setPhase(state.phase);
        setMessage(state.message);
        const goal =
          goals.find(
            (item) => item.status === "ACTIVE" && item.priority === "PRIMARY",
          ) ?? goals.find((item) => item.status === "ACTIVE");
        setMissingFields(
          !readiness.ready ? readiness.missingFields : !goal ? ["goal"] : [],
        );
        if (!generate) {
          setProposal(state.proposal);
          if (state.generation && !state.proposal) {
            trackGeneration(state.generation);
            const next = await waitForCoachProposal(
              token,
              state.generation,
              () => undefined,
              active,
            );
            if (active() && next) setProposal(next);
          }
          return;
        }
        if (!readiness.ready || !goal) return;
        const days =
          (Date.parse(range.endDate) - Date.parse(range.startDate)) /
            86_400_000 +
          1;
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(range.startDate) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(range.endDate) ||
          !Number.isFinite(days) ||
          days < 1 ||
          days > 84 ||
          range.startDate < state.today
        )
          throw new Error("请选择今天或未来开始的有效日期范围，单次 1–84 天");
        const preview = await coachApi.raceImpact(token, raceId, range);
        if (!active()) return;
        setImpact(preview);
        setProposal(null);
        const generation = await coachApi.replanRace(
          token,
          raceId,
          {
            weekStartDate: range.startDate,
            endDate: range.endDate,
            goalId: goal.id,
            mode: "range",
            expectedBaseVersion: plan.planVersion,
            reason: "RACE",
            relatedId: raceId,
            relatedVersion: race.version,
            racePhase: state.phase,
            forceRegenerate,
            notes:
              state.phase === "RECOVERY"
                ? "根据比赛实际结果、疲劳与当前日期安排恢复，说明回归长期目标训练的建议与条件。"
                : state.phase === "RETURN_TO_GOAL"
                  ? "比赛已取消，请从当前日期回归长期目标，重新评估原减量和恢复安排，不直接恢复过期课程。"
                  : "围绕比赛安排专项准备、减量与赛后恢复；兼顾范围内其他赛事优先级，保留测试、历史和已记录课程。",
          },
          key(),
        );
        trackGeneration(generation);
        const next = await waitForCoachProposal(
          token,
          generation,
          () => undefined,
          active,
        );
        if (active() && next) setProposal(next);
      } catch (cause) {
        if (!active()) return;
        if (
          cause instanceof CoachApiError &&
          ["FTP_REQUIRED", "INSUFFICIENT_TRAINING_INPUT"].includes(
            cause.code ?? "",
          )
        ) {
          const parsed = readinessSchema.shape.missingFields.safeParse(
            cause.code === "FTP_REQUIRED" ? ["ftp"] : cause.missingFields,
          );
          if (parsed.success && parsed.data.length) {
            setMissingFields(parsed.data);
            return;
          }
        }
        setError(
          cause instanceof Error ? cause.message : "赛事训练草稿读取或生成失败",
        );
      } finally {
        clearTimeout(timeout);
        if (waitTimeout.current === timeout) waitTimeout.current = null;
        if (active()) {
          setBusy(false);
          running.current = false;
        }
      }
    },
    [raceId, token, phaseRequest, scope, trackGeneration, resetCancellation],
  );

  useFocusEffect(
    useCallback(() => {
      setProposal(null);
      setImpact(null);
      void run(false);
      return () => {
        operation.current += 1;
        running.current = false;
        if (waitTimeout.current) clearTimeout(waitTimeout.current);
        waitTimeout.current = null;
      };
    }, [run]),
  );

  const changeDate = (field: "startDate" | "endDate", value: string) => {
    const current = selection.current ?? { scope, startDate, endDate };
    selection.current = { ...current, [field]: value };
    if (field === "startDate") setStartDate(value);
    else setEndDate(value);
    setImpact(null);
  };
  const previewImpact = async () => {
    if (!token || running.current) return;
    const attempt = ++operation.current;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await coachApi.raceImpact(token, raceId, {
        startDate,
        endDate,
      });
      if (operation.current === attempt) setImpact(result);
    } catch (cause) {
      if (operation.current === attempt)
        setError(cause instanceof Error ? cause.message : "影响范围读取失败");
    } finally {
      if (operation.current === attempt) {
        setBusy(false);
        running.current = false;
      }
    }
  };
  return {
    cancellation,
    proposal,
    rangeChanged:
      !!proposal?.weekStartDate &&
      (proposal.weekStartDate !== startDate ||
        (proposal.endDate ?? endDate) !== endDate),
    setProposal,
    missingFields,
    error,
    setError,
    message,
    busy,
    setBusy,
    phase,
    startDate,
    endDate,
    impact,
    changeDate,
    previewImpact,
    generate: () => void run(true),
    regenerate: () => void run(true, true),
    retry: () => void run(false),
  };
}
