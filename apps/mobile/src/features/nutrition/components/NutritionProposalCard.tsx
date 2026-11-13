import { CircleAlert, Sparkles } from "lucide-react-native";
import { View } from "react-native";
import type { NutritionProposalResponse } from "@ridepilot/contracts";

import { colors } from "../../../theme/colors";
import {
  AppText,
  Badge,
  Button,
  Card,
  Disclosure,
} from "../../../components/ui";
import { NutritionDraftReview } from "./NutritionDraftReview";

export function NutritionProposalCard({
  proposal,
  applying,
  validating,
  onValidate,
  onApply,
  onDismiss,
  onEdit,
}: {
  proposal: NutritionProposalResponse;
  applying: boolean;
  validating: boolean;
  onValidate: () => void;
  onApply: () => void;
  onDismiss: () => void;
  onEdit?: (index: number) => void;
}) {
  const canApply = proposal.status === "READY" && proposal.validation.passed;
  const applied = proposal.status === "APPLIED";
  return (
    <Card className="border-brand/60 bg-surface-elevated p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Sparkles color={colors.brand} size={18} />
        <AppText variant="label" className="text-brand">
          {applied ? "AI 营养方案 · 已应用" : "AI 营养草稿 · 尚未应用"}
        </AppText>
        <Badge
          className="ml-auto"
          variant={canApply || applied ? "positive" : "warning"}
        >
          {applied
            ? "已应用"
            : canApply
              ? "可预览应用"
              : proposal.status === "BLOCKED"
                ? "需要调整"
                : "待校验"}
        </Badge>
      </View>
      <AppText variant="section" className="mt-3">
        {proposal.metadata?.summary ?? "已生成一份新的营养安排"}
      </AppText>
      <AppText variant="caption" muted className="mt-2 leading-5">
        {applied
          ? "这份方案已应用到正式饮食计划，可查看已有安排。"
          : "这是建议草稿。确认应用前，正式饮食计划不会变化。"}
      </AppText>
      <View className="mt-4 flex-row gap-2">
        <View className="flex-1 rounded-xl bg-surface-2 p-3">
          <AppText variant="label" muted>
            餐次数
          </AppText>
          <AppText variant="card" className="mt-1 text-brand">
            {proposal.draft.items.length}
          </AppText>
        </View>
        <View className="flex-1 rounded-xl bg-surface-2 p-3">
          <AppText variant="label" muted>
            覆盖日期
          </AppText>
          <AppText variant="card" className="mt-1 text-brand">
            {proposal.draft.startDate === proposal.draft.endDate
              ? proposal.draft.startDate.slice(5)
              : `${proposal.draft.startDate.slice(5)}–${proposal.draft.endDate.slice(5)}`}
          </AppText>
        </View>
      </View>
      {proposal.validation.blockers.length ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-negative/10 p-3">
          <CircleAlert color={colors.negative} size={16} />
          <AppText variant="caption" className="flex-1 text-negative">
            {proposal.validation.blockers.join("；")}
          </AppText>
        </View>
      ) : null}
      {proposal.validation.warnings.length ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-warning/10 p-3">
          <CircleAlert color={colors.warning} size={16} />
          <AppText variant="caption" className="flex-1 text-warning">
            {proposal.validation.warnings.join("；")}
          </AppText>
        </View>
      ) : null}
      <NutritionDraftReview
        proposal={proposal}
        onEdit={onEdit}
        busy={applying || validating}
      />
      {proposal.metadata?.assumptions.length ? (
        <Disclosure title="生成依据">
          <View className="mt-4 rounded-xl border border-border bg-surface-2 p-3">
            <AppText variant="label" className="text-secondary">
              生成依据
            </AppText>
            {proposal.metadata.assumptions.map((item) => (
              <AppText key={item} variant="caption" muted className="mt-2">
                · {item}
              </AppText>
            ))}
          </View>
        </Disclosure>
      ) : null}
      <View className="mt-4 gap-2">
        {!canApply && !applied ? (
          <Button variant="secondary" loading={validating} onPress={onValidate}>
            重新校验草稿
          </Button>
        ) : null}
        {canApply ? (
          <Button loading={applying} disabled={validating} onPress={onApply}>
            确认应用到正式计划
          </Button>
        ) : null}
        <Button
          variant="ghost"
          disabled={applying || validating}
          onPress={onDismiss}
        >
          {applied ? "返回" : "暂不处理"}
        </Button>
      </View>
    </Card>
  );
}
