import type { ProposalResponse } from "@ridepilot/contracts";
import type { TrainingDraftEntry } from "../model/training";
import { TrainingApiError, trainingApi } from "./training.api";

// Clicking Save confirms this manual course. Keep the server's draft,
// validation and atomic publication steps without additional user actions.
export async function saveManualWorkout(
  token: string,
  entry: TrainingDraftEntry,
  onProposal: (proposal: ProposalResponse) => void,
) {
  let proposal = entry.proposal;
  if (!proposal) {
    proposal = entry.workoutId
      ? await trainingApi.createEdit(token, entry.workoutId, {
          ...entry.draft,
          expectedPlanVersion: entry.planVersion!,
        })
      : await trainingApi.createManual(token, entry.draft);
    onProposal(proposal);
  } else if (entry.dirty) {
    // An earlier application may have succeeded despite a lost response.
    // Never overwrite it or silently discard newly entered changes.
    const current = await trainingApi.getProposal(token, proposal.proposalId);
    if (current.status === "APPLIED") {
      throw new TrainingApiError(
        "上次课程已保存成功，请返回训练页重新打开课程后修改。当前填写内容已保留。",
        409,
        "PROPOSAL_ALREADY_APPLIED",
      );
    }
    proposal = await trainingApi.updateProposal(token, proposal.proposalId, {
      expectedProposalVersion: proposal.proposalVersion,
      draft: entry.draft,
    });
    onProposal(proposal);
  }

  if (proposal.status !== "READY" && proposal.status !== "APPLIED") {
    proposal = await trainingApi.validate(token, proposal.proposalId);
    onProposal(proposal);
  }
  if (
    proposal.status !== "APPLIED" &&
    (proposal.status !== "READY" || !proposal.validation.passed)
  ) {
    throw new TrainingApiError(
      proposal.validation.blockers.join("；") ||
        "课程校验未通过，请修改后重试。",
      400,
      "WORKOUT_VALIDATION_FAILED",
    );
  }
  // Unchanged retries go straight to the idempotent apply endpoint. They must
  // not edit/revalidate a proposal which may already have been published.
  return trainingApi.apply(
    token,
    proposal.proposalId,
    proposal.basePlanVersion,
    `training-${proposal.proposalId}`,
  );
}
