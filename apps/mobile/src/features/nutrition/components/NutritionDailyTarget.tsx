import { View } from "react-native";
import type { NutritionPlanResponse } from "@ridepilot/contracts";
import { AppText, Badge, Card } from "../../../components/ui";

export function NutritionDailyTarget({
  target,
  dayLabel,
}: {
  target: NonNullable<NutritionPlanResponse["dailyTarget"]>;
  dayLabel: string;
}) {
  return (
    <Card className="p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText variant="card">{dayLabel}营养目标</AppText>
        <Badge variant={target.confidence === "HIGH" ? "positive" : "warning"}>
          {target.confidence === "HIGH" ? "高置信度" : "估算"}
        </Badge>
      </View>
      <View className="mt-4 flex-row flex-wrap gap-2">
        <Metric label="能量" value={target.energyKcal} unit="kcal" />
        <Metric label="碳水" value={target.carbohydrateG} unit="g" />
        <Metric label="蛋白质" value={target.proteinG} unit="g" />
      </View>
      <AppText variant="caption" muted className="mt-3">
        目标来自
        {target.basis === "ESTIMATE"
          ? "当前训练与个人信息的估算"
          : "已记录数据"}
      </AppText>
    </Card>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <View className="min-w-[80px] flex-1 gap-1">
      <AppText variant="label" muted>
        {label}
      </AppText>
      <AppText variant="card" className="mt-1">
        {value === null ? "—" : Math.round(value)}
      </AppText>
      <AppText variant="label" muted>
        {unit}
      </AppText>
    </View>
  );
}
