import { TrainingNutritionLinkCard } from "../../nutrition/components/TrainingNutritionLinkCard";
import { useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { racePlanningPhaseSchema } from "@ridepilot/contracts";
import { AppText, Button, Card, Input } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { PlanPreview } from "../../coach/components/PlanPreview";
import { missingTrainingData } from "../../coach/model/readiness";
import { useRaceTrainingDraft } from "../hooks/useRaceTrainingDraft";
import { RaceImpactCard } from "../components/RaceImpactCard";

const key = () => `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function RaceProposalScreen() {
  const {
    raceId = "",
    recovery,
    phase: phaseParam,
  } = useLocalSearchParams<{
    raceId?: string;
    recovery?: string;
    phase?: string;
  }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const parsedPhase = racePlanningPhaseSchema.safeParse(phaseParam);
  const draft = useRaceTrainingDraft(
    token,
    raceId,
    recovery === "1",
    parsedPhase.success ? parsedPhase.data : undefined,
  );
  const {
    proposal,
    setProposal,
    missingFields,
    error,
    setError,
    busy,
    setBusy,
    phase,
  } = draft;
  const action = useRef(false);
  const applyAttempt = useRef<{ id: string; key: string } | null>(null);
  const label =
    phase === "RECOVERY"
      ? "赛后恢复"
      : phase === "RETURN_TO_GOAL"
        ? "回归目标"
        : "备赛";
  const apply = async () => {
    if (!token || !proposal || action.current || busy) return;
    action.current = true;
    setBusy(true);
    setError(null);
    try {
      if (proposal.status !== "READY") {
        setProposal(await coachApi.validate(token, proposal.proposalId));
        return;
      }
      if (applyAttempt.current?.id !== proposal.proposalId)
        applyAttempt.current = { id: proposal.proposalId, key: key() };
      await coachApi.apply(
        token,
        proposal.proposalId,
        proposal.basePlanVersion,
        applyAttempt.current.key,
        proposal.proposalVersion,
      );
      setProposal({ ...proposal, status: "APPLIED" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "应用赛事计划失败");
    } finally {
      action.current = false;
      setBusy(false);
    }
  };
  return (
    <TrainingPage
      title={`${label}计划`}
      loading={busy && !proposal}
      error={!draft.startDate ? error : undefined}
      retry={draft.retry}
    >
      {draft.startDate && error ? (
        <AppText className="text-negative">{error}</AppText>
      ) : null}
      {draft.message ? (
        <AppText className="text-warning">{draft.message}</AppText>
      ) : null}
      {missingFields.length ? (
        <Card>
          <AppText variant="card">补全资料后生成{label}计划</AppText>
          <AppText muted className="mt-2">
            还需要：{missingTrainingData(missingFields)}
            。补全后可继续为本赛事生成训练草稿，无需先建立正式计划。
          </AppText>
          <Button
            className="mt-4"
            onPress={() =>
              router.push({
                pathname: "/races/training-setup",
                params: {
                  raceId,
                  ...(recovery ? { recovery } : {}),
                  ...(phaseParam ? { phase: phaseParam } : {}),
                },
              })
            }
          >
            去填写基本信息
          </Button>
        </Card>
      ) : null}
      {draft.startDate && !missingFields.length ? (
        <Card>
          <AppText variant="card">{label}日期范围</AppText>
          <AppText variant="caption" muted className="mt-2">
            支持跨周，单次 1–84
            天。已有课程会提出调整，空白时段会创建训练草稿；确认前正式计划保持原样。
          </AppText>
          <AppText className="mt-3">开始日期</AppText>
          <Input
            accessibilityLabel="开始日期"
            editable={!busy}
            value={draft.startDate}
            onChangeText={(value) => draft.changeDate("startDate", value)}
            placeholder="YYYY-MM-DD"
          />
          <AppText className="mt-3">结束日期</AppText>
          <Input
            accessibilityLabel="结束日期"
            editable={!busy}
            value={draft.endDate}
            onChangeText={(value) => draft.changeDate("endDate", value)}
            placeholder="YYYY-MM-DD"
          />
          <Button
            variant="secondary"
            className="mt-3"
            disabled={busy}
            onPress={() => void draft.previewImpact()}
          >
            查看范围影响
          </Button>
          <Button
            className="mt-3"
            loading={busy}
            onPress={proposal ? draft.regenerate : draft.generate}
          >
            {proposal
              ? `重新生成${label}计划草稿`
              : error
                ? `重新生成${label}计划草稿`
                : `生成${label}计划草稿`}
          </Button>
        </Card>
      ) : null}
      {draft.impact ? <RaceImpactCard impact={draft.impact} /> : null}
      {proposal ? (
        <>
          {draft.rangeChanged && proposal.status !== "APPLIED" ? (
            <AppText className="text-warning">
              日期范围已修改，请重新生成后再确认应用。
            </AppText>
          ) : null}
          <PlanPreview
            proposal={proposal}
            ftpWatts={null}
            nutritionSummary="以饮食档案及独立补给方案为准"
          />
          {proposal.status === "APPLIED" ? (
            <TrainingNutritionLinkCard
              dates={[
                proposal.weekStartDate ?? draft.startDate,
                proposal.endDate ?? draft.endDate,
              ]}
            />
          ) : null}
          {proposal.status === "APPLIED" ? (
            <Card>
              <AppText className="text-positive">已应用{label}计划</AppText>
              <AppText muted className="mt-2">
                再次进入可查看该方案。重新生成会先创建新草稿，确认后才会更新训练。
              </AppText>
            </Card>
          ) : (
            <Button
              loading={busy}
              disabled={
                busy ||
                draft.rangeChanged ||
                proposal.blockers.length > 0 ||
                ["EXPIRED", "REJECTED"].includes(proposal.status)
              }
              onPress={() => void apply()}
            >
              {proposal.status === "READY"
                ? `确认应用${label}计划`
                : "校验草稿"}
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => router.push("/(tabs)/training")}
          >
            查看训练日历
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() =>
              phase === "PREPARATION"
                ? router.push({
                    pathname: "/races/nutrition-proposal",
                    params: { raceId },
                  })
                : router.push("/(tabs)/nutrition")
            }
          >
            {phase === "PREPARATION" ? "查看或调整赛事补给" : "查看恢复期饮食"}
          </Button>
        </>
      ) : null}
      <Button variant="secondary" disabled={busy} onPress={() => router.back()}>
        返回赛事
      </Button>
    </TrainingPage>
  );
}
