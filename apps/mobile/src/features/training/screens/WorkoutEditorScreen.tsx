import { router } from "expo-router";
import { useEffect } from "react";
import { Editor } from "../components/Editor";
import { TrainingPage, backToTraining } from "../components/TrainingPage";
import { useWorkoutEditor } from "../hooks/useWorkoutEditor";
import { useUnsavedTraining } from "../hooks/useUnsavedTraining";
import { useFtpRequirement } from "../hooks/useFtpRequirement";
import { FtpRequiredState } from "../components/FtpRequiredState";

export function WorkoutEditorScreen() {
  const state = useWorkoutEditor();
  const ftp = useFtpRequirement();
  const { setFtpAvailable, draftId } = state;
  useEffect(() => {
    if (ftp.available !== null) setFtpAvailable(draftId, ftp.available);
  }, [draftId, ftp.available, setFtpAvailable]);
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
      title="编辑课程"
      busy={state.busy}
      onBack={backToTraining}
      loading={state.loading || (ftp.available === null && !ftp.error)}
      error={state.error ?? ftp.error}
      retry={() => {
        state.retry();
        ftp.retry();
      }}
    >
      {guard}
      {ftp.available === false ? (
        <FtpRequiredState />
      ) : state.entry ? (
        <Editor
          draft={state.entry.draft}
          setDraft={(draft) => state.update(state.draftId, draft)}
          hasFtp={!!ftp.available}
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
