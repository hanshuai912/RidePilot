import { router } from "expo-router";
import { Editor } from "../components/Editor";
import { TrainingPage, backToTraining } from "../components/TrainingPage";
import { useWorkoutEditor } from "../hooks/useWorkoutEditor";
import { useUnsavedTraining } from "../hooks/useUnsavedTraining";

export function WorkoutEditorScreen() {
  const state = useWorkoutEditor();
  const guard = useUnsavedTraining(
    Boolean(state.entry?.dirty),
    undefined,
    state.busy,
  );
  const segment = (index?: number) =>
    router.push({
      pathname: "/workouts/segment",
      params: {
        draftId: state.draftId,
        ...(state.entry?.proposal
          ? { proposalId: state.entry.proposal.proposalId }
          : {}),
        ...(index === undefined ? {} : { index: String(index) }),
      },
    });
  return (
    <TrainingPage
      loading={state.loading}
      error={state.error}
      retry={state.retry}
    >
      {guard}
      {state.entry ? (
        <Editor
          draft={state.entry.draft}
          setDraft={(draft) => state.update(state.draftId, draft)}
          hasFtp={state.entry.hasFtp}
          feedback={state.feedback}
          busy={state.busy}
          onBack={backToTraining}
          onAdd={() => segment()}
          onEdit={segment}
          onDelete={(index) =>
            state.update(state.draftId, {
              ...state.entry!.draft,
              segments: state.entry!.draft.segments.filter(
                (_, i) => i !== index,
              ),
            })
          }
          onSave={() => void state.save()}
        />
      ) : null}
    </TrainingPage>
  );
}
