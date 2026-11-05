import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { PlanPreview } from "../../coach/components/PlanPreview";
import { missingTrainingData } from "../../coach/model/readiness";
import { useRaceTrainingDraft } from "../hooks/useRaceTrainingDraft";

const key = () => `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function RaceProposalScreen() {
  const { raceId = "", recovery } = useLocalSearchParams<{
    raceId?: string;
    recovery?: string;
  }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const {
    proposal,
    setProposal,
    missingFields,
    error,
    setError,
    busy,
    setBusy,
    retry,
    generate,
    weekStartDate,
  } = useRaceTrainingDraft(token, raceId, recovery === "1");
  const validate = async () => {
    if (!token || !proposal) return;
    setBusy(true);
    setError(null);
    try {
      setProposal(await coachApi.validate(token, proposal.proposalId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "备赛草稿校验失败");
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!token || !proposal) return;
    setBusy(true);
    setError(null);
    try {
      await coachApi.apply(
        token,
        proposal.proposalId,
        proposal.basePlanVersion,
        key(),
      );
      router.replace("/(tabs)/training");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "应用备赛计划失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <TrainingPage
      title="备赛调整草稿"
      loading={busy && !proposal}
      error={!weekStartDate ? error : undefined}
      retry={!proposal ? retry : undefined}
    >
      {weekStartDate && error ? (
        <AppText className="text-negative">{error}</AppText>
      ) : null}
      {!proposal && !missingFields.length && weekStartDate ? (
        <Card>
          <AppText variant="card">
            {recovery === "1" ? "生成赛后恢复计划" : "生成备赛计划"}
          </AppText>
          <AppText muted className="mt-2">
            生成范围：{weekStartDate}{" "}
            所在周。已有课程会提出调整，空白时段会创建训练草稿。
          </AppText>
          <Button className="mt-4" loading={busy} onPress={generate}>
            {error ? "重新生成备赛计划草稿" : "生成备赛计划草稿"}
          </Button>
        </Card>
      ) : null}
      {missingFields.length ? (
        <Card>
          <AppText variant="card">补全资料后生成备赛计划</AppText>
          <AppText muted className="mt-2">
            还需要：{missingTrainingData(missingFields)}
            。补全后可继续为本赛事生成训练草稿，无需先建立正式计划。
          </AppText>
          <Button
            className="mt-4"
            onPress={() =>
              router.push({
                pathname: "/races/training-setup",
                params: { raceId, ...(recovery ? { recovery } : {}) },
              })
            }
          >
            去填写基本信息
          </Button>
        </Card>
      ) : null}
      {proposal ? (
        <>
          <PlanPreview proposal={proposal} ftpWatts={null} />
          <Button
            loading={busy}
            disabled={
              proposal.status !== "READY" || proposal.blockers.length > 0
            }
            onPress={() =>
              void (proposal.status === "READY" ? apply() : validate())
            }
          >
            {proposal.status === "READY"
              ? recovery === "1"
                ? "确认应用恢复计划"
                : "确认应用备赛计划"
              : "校验草稿"}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => router.back()}
          >
            返回赛事
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
