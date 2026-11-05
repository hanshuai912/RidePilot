import { useState } from "react";
import type { CycleReviewHistory as History } from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { CycleReviewEvidenceCard } from "./CycleReviewEvidenceCard";
import { cycleActionLabels, cycleStatusLabel } from "./cycle-review.model";

export function CycleReviewHistory({
  history,
  preview,
  resume,
}: {
  history: History;
  preview: (id: string) => void;
  resume: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Card>
      <AppText variant="section">复盘与后续计划历史</AppText>
      <AppText variant="caption" muted className="mt-2">
        最近 30 次主动生成，包含失败任务；仅查看或保留计划不会新增记录。
      </AppText>
      {!history.items.length ? (
        <AppText muted className="mt-3">
          尚未从复盘生成后续计划。
        </AppText>
      ) : null}
      {history.items.map((item) => (
        <Card key={item.generationId} className="mt-3">
          <AppText variant="card">
            {cycleActionLabels[item.review.action]} ·{" "}
            {cycleStatusLabel(item.status)}
          </AppText>
          <AppText muted className="mt-2">
            复盘 {item.review.startDate} 至 {item.review.endDate}
            {"\n"}训练 {item.startDate} 至 {item.endDate}
            {item.appliedPlanVersion
              ? `\n已应用正式训练 v${item.appliedPlanVersion}`
              : ""}
          </AppText>
          {item.proposalId ? (
            <Button
              variant="secondary"
              onPress={() => preview(item.proposalId!)}
            >
              查看这份草稿与结果
            </Button>
          ) : ["QUEUED", "RUNNING", "FAILED"].includes(item.status) ? (
            <Button
              variant="secondary"
              onPress={() => resume(item.generationId)}
            >
              查看生成状态
            </Button>
          ) : null}
          {item.evidence ? (
            <>
              <Button
                variant="ghost"
                onPress={() =>
                  setExpanded(
                    expanded === item.generationId ? null : item.generationId,
                  )
                }
              >
                {expanded === item.generationId
                  ? "收起保存的复盘依据"
                  : "查看保存的复盘依据"}
              </Button>
              {expanded === item.generationId ? (
                <CycleReviewEvidenceCard evidence={item.evidence} />
              ) : null}
            </>
          ) : null}
        </Card>
      ))}
    </Card>
  );
}
