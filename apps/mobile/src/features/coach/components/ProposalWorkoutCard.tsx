import { router } from "expo-router";
import type { AiProposalResponse } from "@ridepilot/contracts";
import { AppText, Button, Card, Disclosure } from "../../../components/ui";
import { segmentTotals } from "../../training/model/segment-totals";
import { WorkoutSegmentList } from "../../training/components/WorkoutSegmentList";

export function ProposalWorkoutCard({
  proposal,
  index,
  ftpWatts,
}: {
  proposal: AiProposalResponse;
  index: number;
  ftpWatts: number | null;
}) {
  const workout = proposal.workouts[index];
  const totals = segmentTotals(workout.segments);
  const summary = [
    totals.minutes ? `${totals.minutes} 分钟` : null,
    totals.kilometers ? `${totals.kilometers} 公里` : null,
    `${workout.segments.length} 个动作`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card className="p-4">
      <AppText variant="label" className="text-brand">
        {workout.scheduledDate} · 第 {index + 1} 节
      </AppText>
      <AppText variant="card" className="mt-2">
        {workout.title}
      </AppText>
      <AppText variant="caption" muted className="mt-1">
        {workout.purpose}
      </AppText>
      <Disclosure
        title={`查看第 ${index + 1} 节动作`}
        summary={summary}
        defaultExpanded={proposal.workouts.length === 1}
      >
        <WorkoutSegmentList segments={workout.segments} ftpWatts={ftpWatts} />
      </Disclosure>
      {["DRAFT", "READY", "BLOCKED"].includes(proposal.status) ? (
        <Button
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/workouts/candidate",
              params: { proposalId: proposal.proposalId, index: String(index) },
            })
          }
        >
          局部编辑第 {index + 1} 节候选
        </Button>
      ) : null}
    </Card>
  );
}
