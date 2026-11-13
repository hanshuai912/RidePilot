import type { AiProposalResponse } from "@ridepilot/contracts";
import { segmentTotals } from "../../training/model/segment-totals";

export function summarizeProposal(
  proposal: Pick<AiProposalResponse, "workouts">,
) {
  const dates = [
    ...new Set(proposal.workouts.map((workout) => workout.scheduledDate)),
  ].sort();
  const totals = proposal.workouts.reduce(
    (sum, workout) => {
      const total = segmentTotals(workout.segments);
      return {
        minutes: sum.minutes + total.minutes,
        kilometers: sum.kilometers + total.kilometers,
      };
    },
    { minutes: 0, kilometers: 0 },
  );
  return {
    ...totals,
    dates,
    days: dates.length,
    courses: proposal.workouts.length,
  };
}
