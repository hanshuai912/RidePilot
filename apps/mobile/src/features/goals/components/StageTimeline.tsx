import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { StagePlanResponse } from "@ridepilot/contracts";
import { AppText, Badge, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { outcomeLabels, decisionLabels } from "../model/goal-lifecycle";
import { goalDateLabel } from "../model/goal-presentation";

export function StageTimeline({
  plan,
  today,
  onReview,
  disabled = false,
  showSummary = true,
}: {
  plan: StagePlanResponse;
  today?: string;
  /** @deprecated Kept for compatibility with legacy callers; new flows do not pass it. */
  onReview?: (stageId: string) => void;
  disabled?: boolean;
  showSummary?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string>();
  const defaultStage =
    plan.stages.find(
      (stage) => today && stage.startDate <= today && stage.endDate >= today,
    ) ??
    plan.stages.find((stage) => !today || stage.startDate > today) ??
    plan.stages[0];
  const openId = expandedId ?? defaultStage?.id;
  return (
    <View className="gap-4" testID="goal-stage-timeline">
      {showSummary && plan.summary ? (
        <AppText className="text-secondary">{plan.summary}</AppText>
      ) : null}
      {plan.stale ? (
        <View className="rounded-xl border border-warning/30 bg-surface-2 p-3">
          <AppText className="text-warning">
            {plan.scope === "LEGACY_GOAL"
              ? "这是旧的单目标阶段安排，请按全部目标重新规划。已有课程和测试保留。"
              : "目标或训练资料已变化，请按全部目标重新生成阶段安排。"}
          </AppText>
        </View>
      ) : null}
      <View>
        {plan.stages.map((stage, index) => {
          const current =
            !!today && stage.startDate <= today && stage.endDate >= today;
          const ended = !!today && stage.endDate < today;
          const expanded = openId === stage.id;
          const status =
            plan.status === "DRAFT"
              ? "待确认"
              : !today
                ? null
                : ended
                  ? "日期已结束"
                  : current
                    ? "当前阶段"
                    : "后续阶段";
          const content = (
            <>
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                {status ? (
                  <Badge
                    variant={
                      current && !plan.stale && plan.status === "ACTIVE"
                        ? "brand"
                        : "neutral"
                    }
                  >
                    {status}
                  </Badge>
                ) : null}
                {expanded ? (
                  <ChevronUp color={colors.textSecondary} size={18} />
                ) : (
                  <ChevronDown color={colors.textSecondary} size={18} />
                )}
              </View>
              <AppText variant="card" className="mt-3">
                {stage.title}
              </AppText>
              <AppText
                variant="caption"
                className="mt-2 tabular-nums text-secondary"
              >
                {goalDateLabel(stage.startDate)} —{" "}
                {goalDateLabel(stage.endDate)}
              </AppText>
            </>
          );
          return (
            <View key={stage.id} className="flex-row gap-3">
              <View className="w-7 items-center">
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full border ${current && !plan.stale ? "border-brand bg-brand-subtle" : "border-border bg-surface"}`}
                >
                  <AppText
                    variant="label"
                    className={
                      current && !plan.stale ? "text-brand" : "text-secondary"
                    }
                  >
                    {stage.position + 1}
                  </AppText>
                </View>
                {index < plan.stages.length - 1 ? (
                  <View className="my-1 w-px flex-1 bg-divider" />
                ) : null}
              </View>
              <Card className="mb-4 min-w-0 flex-1">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${expanded ? "收起" : "展开"}阶段：${stage.title}`}
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedId(expanded ? "" : stage.id)}
                  className="min-h-11 active:opacity-70"
                >
                  {content}
                </Pressable>
                {expanded ? (
                  <View className="mt-3 gap-3">
                    <AppText>{stage.purpose}</AppText>
                    {stage.latestReview ? (
                      <AppText variant="caption" className="text-secondary">
                        最近复评 · {outcomeLabels[stage.latestReview.outcome]} ·{" "}
                        {decisionLabels[stage.latestReview.decision]}
                      </AppText>
                    ) : null}
                    {onReview ? (
                      <Button
                        variant="secondary"
                        disabled={disabled}
                        onPress={() => onReview(stage.id)}
                      >
                        复评并选择下一步
                      </Button>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            </View>
          );
        })}
      </View>
    </View>
  );
}
