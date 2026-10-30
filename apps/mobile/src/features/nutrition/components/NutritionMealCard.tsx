import { ChevronRight, CircleAlert, Clock3, Dumbbell } from "lucide-react-native";
import { Pressable, View } from "react-native";
import type { NutritionPlanResponse } from "@ridepilot/contracts";

import { colors } from "../../../theme/colors";
import { AppText, Badge, Card } from "../../../components/ui";
import { formatNutrient, mealTypeLabels } from "../model/nutrition";

type NutritionItem = NutritionPlanResponse["items"][number];

export function NutritionMealCard({
  item,
  onSwap,
}: {
  item: NutritionItem;
  onSwap?: (item: NutritionItem) => void;
}) {
  const hasWarning = item.warnings.length > 0;
  return (
    <Card className="p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <AppText variant="label" className="text-brand">{item.scheduledLocalTime}</AppText>
            <AppText variant="label" muted>{mealTypeLabels[item.mealType]}</AppText>
          </View>
          <AppText variant="card" className="mt-2">{item.title}</AppText>
        </View>
        {onSwap ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`替换${mealTypeLabels[item.mealType]}`}
            className="h-11 flex-row items-center gap-1 rounded-xl border border-border bg-surface-2 px-3"
            onPress={() => onSwap(item)}
          >
            <AppText variant="label" className="text-brand">替换</AppText>
            <ChevronRight color={colors.brand} size={16} />
          </Pressable>
        ) : null}
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {item.foods.map((food) => (
          <Badge key={`${food.name}-${food.amount}`} variant={food.ingredientStatus === "KNOWN" ? "neutral" : "warning"}>
            {food.name} {food.amount}{food.unit}
          </Badge>
        ))}
      </View>
      <View className="mt-4 flex-row flex-wrap gap-x-4 gap-y-2 border-t border-divider pt-3">
        <AppText variant="caption" muted>能量 {formatNutrient(item.nutrients.energyKcal, "kcal")}</AppText>
        <AppText variant="caption" muted>碳水 {formatNutrient(item.nutrients.carbohydrateG, "g")}</AppText>
        {item.nutrients.fluidMl !== null ? <AppText variant="caption" muted>水分 {formatNutrient(item.nutrients.fluidMl, "ml")}</AppText> : null}
      </View>
      {item.linkedWorkoutId ? (
        <View className="mt-3 flex-row items-center gap-2">
          <Dumbbell color={colors.positive} size={15} />
          <AppText variant="caption" className="text-positive">已关联训练补给</AppText>
        </View>
      ) : null}
      {item.notes ? <AppText variant="caption" muted className="mt-3 leading-5">{item.notes}</AppText> : null}
      {hasWarning ? (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-warning/10 px-3 py-2">
          <CircleAlert color={colors.warning} size={15} />
          <AppText variant="caption" className="flex-1 text-warning">{item.warnings.join("；")}</AppText>
        </View>
      ) : null}
      <View className="mt-3 flex-row items-center gap-2">
        <Clock3 color={colors.textMuted} size={14} />
        <AppText variant="label" muted>{item.nutritionSource === "AI_ESTIMATE" ? "AI 估算 · 请按标签核对" : "已记录来源"}</AppText>
      </View>
    </Card>
  );
}
