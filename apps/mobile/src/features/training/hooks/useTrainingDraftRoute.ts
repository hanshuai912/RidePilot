import { useCallback, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { trainingApi } from "../services/training.api";
import { useTrainingResource } from "./useTrainingResource";
import { useTrainingDrafts } from "./TrainingDraftProvider";

export function useTrainingDraftRoute() {
  const {
    draftId: paramId,
    proposalId,
    workoutId,
  } = useLocalSearchParams<{
    draftId?: string;
    proposalId?: string;
    workoutId?: string;
  }>();
  const draftId =
    paramId ??
    (workoutId
      ? `workout-${workoutId}`
      : proposalId
        ? `proposal-${proposalId}`
        : "missing");
  const { session } = useAuth();
  const token = session?.accessToken;
  const { entries, restore, ...actions } = useTrainingDrafts();
  const entry = entries[draftId];
  const load = useCallback(async () => {
    if (entry) return null;
    if (!token || !proposalId)
      throw new Error("本地草稿已失效，请返回训练页重新创建课程。");
    const proposal = await trainingApi.getProposal(token, proposalId);
    const calendar = await trainingApi.getCalendar(
      token,
      proposal.draftWorkout.scheduledDate,
      proposal.draftWorkout.scheduledDate,
    );
    return { proposal, hasFtp: calendar.ftpAvailable };
  }, [entry, token, proposalId]);
  const resource = useTrainingResource(load);
  useEffect(() => {
    if (resource.data)
      restore(draftId, resource.data.proposal, resource.data.hasFtp);
  }, [resource.data, restore, draftId]);
  return {
    ...resource,
    ...actions,
    draftId,
    entry,
    token,
    params: {
      draftId,
      ...(entry?.proposal ? { proposalId: entry.proposal.proposalId } : {}),
    },
  };
}
