import { useRef, useState } from "react";
import { router } from "expo-router";
import { AppText, Button } from "../../../components/ui";
import { Preview } from "../components/Preview";
import { TrainingPage } from "../components/TrainingPage";
import { useTrainingDraftRoute } from "../hooks/useTrainingDraftRoute";
import { trainingApi } from "../services/training.api";

export function WorkoutPreviewScreen() {
  const state = useTrainingDraftRoute();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const proposal = state.entry?.proposal;
  const back = () =>
    router.dismissTo({ pathname: "/workouts/editor", params: state.params });
  const submit = async (apply: boolean) => {
    if (!state.token || !proposal || pending.current || state.entry?.dirty)
      return;
    pending.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      if (apply) {
        await trainingApi.apply(
          state.token,
          proposal.proposalId,
          proposal.basePlanVersion,
          `training-${proposal.proposalId}`,
        );
        state.remove(state.draftId);
        router.dismissTo("/(tabs)/training");
      } else {
        state.saved(
          state.draftId,
          await trainingApi.validate(state.token, proposal.proposalId),
        );
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "课程保存失败");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const applied = proposal?.status === "APPLIED";
  return (
    <TrainingPage
      loading={!state.entry && state.loading}
      error={
        state.error ??
        (state.entry && !proposal ? "请先保存课程草稿，再查看预览。" : null)
      }
      retry={state.retry}
    >
      {applied ? (
        <>
          <AppText>课程已应用到正式计划。</AppText>
          <Button onPress={() => router.dismissTo("/(tabs)/training")}>
            返回训练
          </Button>
        </>
      ) : state.entry?.dirty ? (
        <>
          <AppText>课程已有新修改，请重新保存后再确认。</AppText>
          <Button onPress={back}>继续编辑</Button>
        </>
      ) : proposal ? (
        <Preview
          proposal={proposal}
          feedback={feedback}
          busy={busy}
          onBack={back}
          onValidate={() => void submit(false)}
          onApply={() => void submit(true)}
        />
      ) : null}
    </TrainingPage>
  );
}
