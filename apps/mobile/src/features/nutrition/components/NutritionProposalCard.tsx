import { CheckCircle2, CircleAlert, Sparkles } from "lucide-react-native";
import { View } from "react-native";
import type { NutritionProposalResponse } from "@ridepilot/contracts";

import { colors } from "../../../theme/colors";
import { AppText, Badge, Button, Card } from "../../../components/ui";
import { formatNutrient, mealTypeLabels } from "../model/nutrition";

export function NutritionProposalCard({
  proposal,
  applying,
  validating,
  onValidate,
  onApply,
  onDismiss,
}: {
  proposal: NutritionProposalResponse;
  applying: boolean;
  validating: boolean;
  onValidate: () => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const canApply = proposal.status === "READY" && proposal.validation.passed;
  return (
    <Card className="border-brand/60 bg-surface-elevated p-4">
      <View className="flex-row items-center gap-2">
        <Sparkles color={colors.brand} size={18} />
        <AppText variant="label" className="text-brand">AI 营养草稿 · 尚未应用</AppText>
        <Badge className="ml-auto" variant={canApply ? "positive" : "warning"}>
          {canApply ? "可预览应用" : proposal.status === "BLOCKED" ? "需要调整" : "待校验"}
        </Badge>
      </View>
      <AppText variant="section" className="mt-3">{proposal.metadata?.summary ?? "已生成一份新的营养安排"}</AppText>
      <AppText variant="caption" muted className="mt-2 leading-5">
        这是建议草稿。确认应用前，正式饮食计划不会变化。
      </AppText>
      <View className="mt-4 flex-row gap-2">
        <View className="flex-1 rounded-xl bg-surface-2 p-3">
          <AppText variant="label" muted>餐次数</AppText>
          <AppText variant="card" className="mt-1 text-brand">{proposal.draft.items.length}</AppText>
        </View>
        <View className="flex-1 rounded-xl bg-surface-2 p-3">
          <AppText variant="label" muted>覆盖日期</AppText>
          <AppText variant="card" className="mt-1 text-brand">{proposal.draft.startDate === proposal.draft.endDate ? proposal.draft.startDate.slice(5) : `${proposal.draft.startDate.slice(5)}–${proposal.draft.endDate.slice(5)}`}</AppText>
        </View>
      </View>
      <View className="mt-4 gap-2">
        {proposal.draft.items.slice(0, 4).map((item, index) => (
          <View key={`${item.localDate}-${item.mealType}-${index}`} className="flex-row items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
            <AppText variant="label" className="w-14 text-brand">{mealTypeLabels[item.mealType]}</AppText>
            <View className="flex-1">
              <AppText variant="caption">{item.title}</AppText>
              <AppText variant="label" muted className="mt-1">{formatNutrient(item.nutrients.energyKcal, "kcal")}</AppText>
            </View>
          </View>
        ))}
        {proposal.draft.items.length > 4 ? <AppText variant="caption" muted>还有 {proposal.draft.items.length - 4} 个餐次，打开计划后可继续查看。</AppText> : null}
      </View>
      {proposal.metadata?.assumptions.length ? (
        <View className="mt-4 rounded-xl border border-border bg-surface-2 p-3">
          <AppText variant="label" className="text-secondary">生成依据</AppText>
          {proposal.metadata.assumptions.slice(0, 3).map((item) => <AppText key={item} variant="caption" muted className="mt-2">· {item}</AppText>)}
        </View>
      ) : null}
      {proposal.validation.warnings.length ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-warning/10 p-3">
          <CircleAlert color={colors.warning} size={16} />
          <AppText variant="caption" className="flex-1 text-warning">{proposal.validation.warnings.join("；")}</AppText>
        </View>
      ) : null}
      {proposal.validation.blockers.length ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-negative/10 p-3">
          <CircleAlert color={colors.negative} size={16} />
          <AppText variant="caption" className="flex-1 text-negative">{proposal.validation.blockers.join("；")}</AppText>
        </View>
      ) : null}
      <View className="mt-4 gap-2">
        {!canApply ? <Button variant="secondary" loading={validating} onPress={onValidate}>重新校验草稿</Button> : null}
        {canApply ? <Button loading={applying} onPress={onApply}>确认应用到正式计划</Button> : null}
        <Button variant="ghost" onPress={onDismiss}>暂不处理</Button>
      </View>
      <View className="mt-2 flex-row items-center gap-2">
        <CheckCircle2 color={colors.positive} size={14} />
        <AppText variant="label" muted>应用操作支持版本校验和幂等重试</AppText>
      </View>
    </Card>
  );
}
