import { View } from "react-native";
import type { AiProposalResponse } from "@ridepilot/contracts";

import { AppText, Button, Card } from "../../../components/ui";
import type { Workout } from "../model/training";

export function WorkoutAdjustmentPreview({
  original,
  proposal,
  loading,
  error,
  onApply,
  onClose,
}: {
  original: Workout;
  proposal: AiProposalResponse;
  loading: boolean;
  error: string | null;
  onApply: () => void;
  onClose: () => void;
}) {
  const replacement = proposal.workouts[0];
  return (
    <View className="flex-1 justify-end bg-black/70">
      <View className="max-h-[88%] rounded-t-[24px] border border-border bg-surface px-5 pb-8 pt-3">
        <View className="mx-auto mb-5 h-1 w-9 rounded-full bg-muted" />
        <AppText variant="label" className="text-brand">
          调整草稿 · 尚未应用
        </AppText>
        <AppText variant="section" className="mt-2">
          确认这节训练的新方案？
        </AppText>
        <AppText className="mt-2 text-secondary">
          {original.scheduledDate} · {proposal.summary}
        </AppText>
        <Card className="mt-4 bg-surface-2">
          <View className="flex-row items-center justify-between border-b border-divider pb-3">
            <AppText variant="label" muted>
              原课程
            </AppText>
            <AppText variant="caption" className="text-secondary">
              {original.title || "骑行训练"} · {original.segments.length} 个动作
            </AppText>
          </View>
          <View className="flex-row items-center justify-between pt-3">
            <AppText variant="label" className="text-brand">
              调整后
            </AppText>
            <AppText variant="caption" className="text-brand">
              {replacement?.scheduledDate} · {replacement?.title ?? "骑行训练"}{" "}
              · {replacement?.segments.length ?? 0} 个动作
            </AppText>
          </View>
          <AppText variant="caption" muted className="mt-3">
            {replacement?.purpose ?? "保留当前训练目的"}
          </AppText>
        </Card>
        {proposal.warnings.map((warning) => (
          <AppText
            key={warning}
            variant="caption"
            className="mt-3 text-warning"
          >
            {warning}
          </AppText>
        ))}
        {error ? (
          <AppText variant="caption" className="mt-3 text-negative">
            {error}
          </AppText>
        ) : null}
        <Button size="lg" className="mt-5" loading={loading} onPress={onApply}>
          确认应用这节训练
        </Button>
        <Button
          variant="secondary"
          className="mt-2"
          disabled={loading}
          onPress={onClose}
        >
          返回课程
        </Button>
      </View>
    </View>
  );
}
