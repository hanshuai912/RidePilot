import { GenerationCancelButton } from "../../coach/components/GenerationCancelButton";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { NutritionProposalCard } from "../../nutrition/components/NutritionProposalCard";
import { nutritionApi } from "../../nutrition/services/nutrition.api";
import { useRaceNutritionDraft } from "../hooks/useRaceNutritionDraft";

export function RaceNutritionProposalScreen() {
  const { raceId = "" } = useLocalSearchParams<{ raceId?: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const {
    proposal,
    setProposal,
    error,
    setError,
    generating,
    cancellation,
    status,
    retry,
    regenerate,
  } = useRaceNutritionDraft(raceId, token);
  const [busy, setBusy] = useState(false);
  const validate = async () => {
    if (!token || !proposal) return;
    setBusy(true);
    setError(null);
    try {
      setProposal(await nutritionApi.validate(token, proposal.proposalId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "营养草稿校验失败");
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!token || !proposal) return;
    setBusy(true);
    setError(null);
    try {
      await nutritionApi.apply(
        token,
        proposal.proposalId,
        proposal.baseNutritionVersion,
      );
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "应用营养草稿失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <TrainingPage
      title={proposal?.status === "APPLIED" ? "赛事补给方案" : "赛事补给草稿"}
      error={error}
      retry={!proposal ? retry : undefined}
    >
      {generating && !proposal ? (
        <Card>
          <Spinner accessibilityLabel="正在生成赛事补给草稿" />
          <GenerationCancelButton cancellation={cancellation} />
          <AppText variant="card" className="mt-3">
            {status === "READING"
              ? "正在读取赛事和饮食计划"
              : status === "QUEUED"
                ? "补给草稿已提交，正在排队"
                : "正在生成并校验赛事补给草稿"}
          </AppText>
          <AppText variant="caption" muted className="mt-2">
            确认应用前不会修改正式饮食计划。等待超时后可重试继续查询。
          </AppText>
        </Card>
      ) : null}
      {proposal ? (
        <>
          <NutritionProposalCard
            proposal={proposal}
            applying={busy}
            validating={busy}
            onValidate={() => void validate()}
            onApply={() => void apply()}
            onDismiss={() => router.back()}
          />
          <Button
            variant="secondary"
            disabled={busy || generating}
            onPress={regenerate}
          >
            重新生成赛事补给
          </Button>
          <AppText variant="caption" muted>
            重新生成的建议会先保存为草稿，确认应用后才替换正式饮食计划。
          </AppText>
        </>
      ) : null}
      <Button variant="secondary" disabled={busy} onPress={() => router.back()}>
        返回赛事
      </Button>
    </TrainingPage>
  );
}
