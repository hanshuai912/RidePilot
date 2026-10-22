import { Stack, router, useLocalSearchParams } from "expo-router";
import { SegmentStep } from "../components/SegmentStep";
import { TrainingPage } from "../components/TrainingPage";
import { useTrainingDraftRoute } from "../hooks/useTrainingDraftRoute";

export function WorkoutSegmentScreen() {
  const state = useTrainingDraftRoute();
  const { index: rawIndex } = useLocalSearchParams<{ index?: string }>();
  const index = rawIndex === undefined ? null : Number(rawIndex);
  const valid =
    index === null ||
    (Number.isInteger(index) &&
      index >= 0 &&
      Boolean(state.entry?.draft.segments[index]));
  const back = () =>
    router.dismissTo({ pathname: "/workouts/editor", params: state.params });
  return (
    <TrainingPage
      loading={!state.entry && state.loading}
      error={
        state.error ??
        (state.entry && !valid ? "训练动作不存在，请返回课程重新选择。" : null)
      }
      retry={state.retry}
    >
      <Stack.Screen
        options={{ title: rawIndex === undefined ? "添加动作" : "编辑动作" }}
      />
      {state.entry && valid ? (
        <SegmentStep
          initial={
            index === null ? undefined : state.entry.draft.segments[index]
          }
          hasFtp={state.entry.hasFtp}
          onBack={back}
          onSave={(segment) => {
            const segments = [...state.entry!.draft.segments];
            if (index === null) segments.push(segment);
            else segments[index] = segment;
            state.update(state.draftId, { ...state.entry!.draft, segments });
            back();
          }}
        />
      ) : null}
    </TrainingPage>
  );
}
