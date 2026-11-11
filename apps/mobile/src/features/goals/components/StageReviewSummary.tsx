import { useState } from "react";
import { View } from "react-native";
import type {
  StageReviewEvidence,
  StageReviewInput,
} from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { decisionLabels, outcomeLabels } from "../model/goal-lifecycle";
import { StageReviewEvidenceCard } from "./StageReviewEvidenceCard";

export function StageReviewDecision({
  input,
}: {
  input: Pick<StageReviewInput, "outcome" | "decision" | "rationale">;
}) {
  return (
    <View className="gap-4">
      {[
        ["复评结论", outcomeLabels[input.outcome]],
        ["下一步", decisionLabels[input.decision]],
        ["理由与证据", input.rationale],
      ].map(([label, value]) => (
        <View key={label} className="gap-1">
          <AppText variant="caption" className="text-secondary">
            {label}
          </AppText>
          <AppText>{value}</AppText>
        </View>
      ))}
    </View>
  );
}

export function StageReviewSummary({
  evidence,
  saved,
  busy,
  onReview,
}: {
  evidence: StageReviewEvidence;
  saved: boolean;
  busy: boolean;
  onReview: () => void;
}) {
  const [details, setDetails] = useState(false);
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText variant="section">最近复评</AppText>
        <Button variant="ghost" size="sm" disabled={busy} onPress={onReview}>
          重新复评
        </Button>
      </View>
      <Card className="gap-4 p-5">
        {saved ? (
          <AppText accessibilityLiveRegion="polite" className="text-positive">
            阶段复评已保存
          </AppText>
        ) : null}
        <AppText variant="caption" className="text-secondary">
          {evidence.createdAt.slice(0, 10)}
        </AppText>
        <StageReviewDecision input={evidence} />
        <Button
          variant="ghost"
          size="sm"
          accessibilityState={{ expanded: details }}
          disabled={busy}
          onPress={() => setDetails((v) => !v)}
        >
          {details ? "收起保存时依据" : "查看保存时依据"}
        </Button>
      </Card>
      {details ? <StageReviewEvidenceCard evidence={evidence} /> : null}
    </View>
  );
}
