import type { CycleReviewEvidence } from "@ridepilot/contracts";
import { AppText, Card } from "../../../components/ui";
import { cycleActionLabels } from "./cycle-review.model";

export function CycleReviewEvidenceCard({
  evidence,
}: {
  evidence: CycleReviewEvidence;
}) {
  const { snapshot: r } = evidence;
  return (
    <Card>
      <AppText variant="card">本草稿的周期复盘依据</AppText>
      <AppText className="mt-2">
        {r.startDate} 至 {r.endDate} · 基于训练 v{r.planVersion}
      </AppText>
      <AppText className="mt-2 text-brand">
        选择：{cycleActionLabels[evidence.action]}
      </AppText>
      <AppText muted className="mt-2">
        计划 {r.stats.planned} · 完成 {r.stats.completed} · 部分完成{" "}
        {r.stats.partial} · 跳过 {r.stats.skipped} · 未记录 {r.stats.unrecorded}
      </AppText>
      {r.recommendation.reasons.map((text) => (
        <AppText key={text} muted className="mt-2">
          {text}
        </AppText>
      ))}
      <AppText variant="caption" muted className="mt-2">
        这是生成时保存的依据。应用前会核对最新反馈、资料和正式版本。
      </AppText>
    </Card>
  );
}
