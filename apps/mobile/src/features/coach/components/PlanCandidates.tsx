import { View } from "react-native";
import type { AiProposalResponse } from "@ridepilot/contracts";
import { AppText, Badge, Card } from "../../../components/ui";
import { summarizeProposal } from "../model/proposal-summary";

export function PlanCandidates({ proposal }: { proposal: AiProposalResponse }) {
  const summary = summarizeProposal(proposal);
  return (
    <Card className="gap-3 p-5">
      <Badge variant="brand">训练草稿 · 尚未应用</Badge>
      <AppText variant="section">{proposal.summary}</AppText>
      <View className="flex-row flex-wrap gap-x-5 gap-y-2 border-y border-divider py-3">
        <AppText>
          {summary.days} 个训练日 · {summary.courses} 节课程
        </AppText>
        {summary.minutes > 0 ? <AppText>{summary.minutes} 分钟</AppText> : null}
        {summary.kilometers > 0 ? (
          <AppText>{summary.kilometers} 公里距离目标</AppText>
        ) : null}
      </View>
      <AppText className="text-secondary">{proposal.stageSummary}</AppText>
      <AppText variant="caption" muted>
        {proposal.stagePlan
          ? "下一步核对课程与阶段安排，一次确认后生效。"
          : "下一步核对日期、课程变化与限制，再确认应用到正式计划。"}
      </AppText>
    </Card>
  );
}
