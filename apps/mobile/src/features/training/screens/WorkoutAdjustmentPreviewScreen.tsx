import { TrainingNutritionLinkCard } from "../../nutrition/components/TrainingNutritionLinkCard";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button } from "../../../components/ui";
import { TrainingPage } from "../components/TrainingPage";
import { WorkoutAdjustmentPreview } from "../components/WorkoutAdjustmentPreview";
import { useWorkoutAdjustmentPreview } from "../hooks/useWorkoutAdjustmentPreview";
import { useWorkoutActionExit } from "../hooks/useWorkoutActionExit";
import {
  workoutActionDestination,
  workoutActionSource,
} from "../model/workout-action-navigation";

export function WorkoutAdjustmentPreviewScreen() {
  const { workoutId = "", source: rawSource } = useLocalSearchParams<{
    workoutId?: string;
    source?: string;
  }>();
  const source = workoutActionSource(rawSource);
  const state = useWorkoutAdjustmentPreview();
  const busy = state.busy;
  const { guard, finish } = useWorkoutActionExit(false, busy);
  const alreadyApplied =
    state.data?.proposal.status === "APPLIED" || !!state.appliedDate;
  const openLatest = () =>
    finish(
      workoutActionDestination(source, workoutId, {
        applied: true,
        date: state.appliedDate ?? state.data?.workout.scheduledDate,
        saved: !!state.appliedDate,
      }),
    );
  const back = () => {
    if (alreadyApplied) {
      openLatest();
      return;
    }
    if (router.canGoBack()) router.back();
    else
      router.replace({
        pathname: "/workouts/adjust",
        params: { workoutId, source },
      });
  };
  return (
    <TrainingPage
      title="调整预览"
      onBack={back}
      busy={busy}
      loading={state.loading}
      error={state.error}
      retry={state.retry}
    >
      {guard}
      {alreadyApplied ? (
        <>
          <AppText>调整已应用，请查看最新计划。</AppText>
          <TrainingNutritionLinkCard
            dates={[
              state.appliedDate ?? state.data?.workout.scheduledDate ?? "",
            ].filter(Boolean)}
          />
          <Button onPress={openLatest}>查看最新计划</Button>
        </>
      ) : state.data ? (
        <WorkoutAdjustmentPreview
          original={state.data.workout}
          proposal={state.data.proposal}
          loading={busy}
          error={state.actionError}
          onApply={() => void state.apply()}
          onClose={back}
        />
      ) : null}
    </TrainingPage>
  );
}
