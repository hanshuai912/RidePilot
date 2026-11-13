import { View } from "react-native";
import type { NutritionPlanResponse } from "@ridepilot/contracts";
import {
  AppText,
  Badge,
  Button,
  Card,
  Disclosure,
} from "../../../components/ui";
import {
  mealTypeLabels,
  formatNutrient,
} from "../../nutrition/model/nutrition";
import type { HomeResource } from "../hooks/useHomeData";
import { HomeResourceFeedback } from "./HomeResourceFeedback";

export function HomeNutritionSection({
  resource,
  onRetry,
  onOpen,
}: {
  resource: HomeResource<NutritionPlanResponse>;
  onRetry: () => void;
  onOpen: () => void;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="section">今日饮食</AppText>
        <Button size="sm" variant="ghost" onPress={onOpen}>
          查看全部 →
        </Button>
      </View>
      <HomeResourceFeedback
        {...resource}
        cached={!!resource.data}
        label="今日饮食"
        onRetry={onRetry}
      />
      {resource.data ? (
        <Card className="gap-3 p-4">
          {!resource.data.items.length ? (
            <>
              <AppText variant="card">
                {resource.data.status === "NOT_GENERATED"
                  ? "今天还没有饮食计划"
                  : "今天暂无餐次安排"}
              </AppText>
              <AppText variant="caption" muted>
                可以前往饮食页填写偏好，生成草稿并确认应用。没有训练的日子也可以安排饮食。
              </AppText>
              <Button variant="secondary" onPress={onOpen}>
                安排今日饮食
              </Button>
            </>
          ) : (
            <>
              <AppText variant="label" muted>
                正式饮食建议 · 未作为实际摄入记录
              </AppText>
              <AppText variant="card">
                已安排 {resource.data.items.length} 个餐次
              </AppText>
              <AppText variant="caption" muted>
                餐食与骑行补给的时间、份量可在饮食页查看和调整。
              </AppText>
              {resource.data.items.some(
                (item) =>
                  item.warnings.length ||
                  item.foods.some((food) => food.ingredientStatus !== "KNOWN"),
              ) ? (
                <AppText variant="caption" className="text-warning">
                  部分餐次有注意事项或成分待确认，用餐前请核对。
                </AppText>
              ) : null}
              <Disclosure title="展开今日餐次">
                {resource.data.items.map((item) => (
                  <View
                    key={item.id}
                    className="gap-2 rounded-xl bg-surface-2 p-3"
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          item.mealType.includes("WORKOUT")
                            ? "brand"
                            : "neutral"
                        }
                      >
                        {mealTypeLabels[item.mealType]}
                      </Badge>
                      <AppText variant="caption" muted>
                        {item.scheduledLocalTime}
                      </AppText>
                    </View>
                    <AppText variant="card">{item.title}</AppText>
                    <AppText variant="caption" muted>
                      能量 {formatNutrient(item.nutrients.energyKcal, "kcal")} ·
                      碳水 {formatNutrient(item.nutrients.carbohydrateG, "g")}
                    </AppText>
                    <AppText variant="label" muted>
                      {item.nutritionSource === "AI_ESTIMATE"
                        ? "AI 估算 · 请核对食品标签"
                        : "依已记录来源提供"}
                    </AppText>
                    {item.warnings.map((warning) => (
                      <AppText
                        key={warning}
                        variant="caption"
                        className="text-warning"
                      >
                        {warning}
                      </AppText>
                    ))}
                    {item.foods.some(
                      (food) => food.ingredientStatus !== "KNOWN",
                    ) ? (
                      <AppText variant="caption" className="text-warning">
                        部分成分尚未确认，请核对过敏原与饮食禁忌。
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </Disclosure>
              <Button variant="secondary" onPress={onOpen}>
                查看与调整餐食 / 补给
              </Button>
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}
