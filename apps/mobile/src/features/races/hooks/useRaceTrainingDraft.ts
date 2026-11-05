import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { readinessSchema, type AiProposalResponse } from "@ridepilot/contracts";
import { coachApi, CoachApiError } from "../../coach/services/coach.api";
import { waitForCoachProposal } from "../../coach/services/generation-task";

type MissingFields = ReturnType<typeof readinessSchema.parse>["missingFields"];

const monday = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};
const key = () => `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useRaceTrainingDraft(
  token: string | undefined,
  raceId: string,
  recovery: boolean,
) {
  const [proposal, setProposal] = useState<AiProposalResponse | null>(null);
  const [missingFields, setMissingFields] = useState<MissingFields>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weekStartDate, setWeekStartDate] = useState<string | null>(null);
  const operation = useRef(0);
  const running = useRef(false);
  const run = useCallback(
    async (generate: boolean) => {
      if (!token || !raceId || running.current) return;
      const attempt = ++operation.current;
      const active = () => operation.current === attempt;
      running.current = true;
      const attemptKey = key();
      setProposal(null);
      setMissingFields([]);
      setError(null);
      setBusy(true);
      try {
        const [race, goals, plan, readiness] = await Promise.all([
          coachApi.race(token, raceId),
          coachApi.goals(token),
          coachApi.planStatus(token),
          coachApi.readiness(token),
        ]);
        if (!active()) return;
        if (!readiness.ready) {
          setMissingFields(readiness.missingFields);
          return;
        }
        const goal =
          goals.find(
            (item) => item.status === "ACTIVE" && item.priority === "PRIMARY",
          ) ?? goals.find((item) => item.status === "ACTIVE");
        if (!goal) {
          setMissingFields(["goal"]);
          return;
        }
        setWeekStartDate(monday(race.localDate));
        if (!generate) return;
        const generation = await coachApi.replanRace(
          token,
          race.id,
          {
            weekStartDate: monday(race.localDate),
            goalId: goal.id,
            mode: "replace_week",
            expectedBaseVersion: plan.planVersion,
            reason: "RACE",
            relatedId: race.id,
            notes: recovery
              ? "比赛已结束，请优先安排赛后恢复周，并根据实际结果决定回归正式训练的日期。"
              : "请围绕赛事安排赛前减量、比赛日和赛后恢复；该范围没有训练计划时，创建相应训练课程。",
          },
          attemptKey,
        );
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
        setError(cause instanceof Error ? cause.message : "备赛草稿生成失败");
      } finally {
        if (active()) {
          setBusy(false);
          running.current = false;
        }
      }
    },
    [raceId, token, recovery],
  );
  useFocusEffect(
    useCallback(() => {
      setWeekStartDate(null);
      void run(false);
      return () => {
        operation.current += 1;
        running.current = false;
      };
    }, [run]),
  );
  return {
    proposal,
    setProposal,
    missingFields,
    error,
    setError,
    busy,
    setBusy,
    weekStartDate,
    generate: () => void run(true),
    retry: () => void run(false),
  };
}
