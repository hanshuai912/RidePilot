import { View } from "react-native";
import type {
  NutritionItemDraft,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { AppText, Button, Disclosure } from "../../../components/ui";
import { mealTypeLabels, formatNutrient } from "../model/nutrition";

function Meal({ item }: { item: NutritionItemDraft }) {
  return (
    <View className="mt-2">
      <AppText variant="caption">
        {item.scheduledLocalTime} · {mealTypeLabels[item.mealType]} ·{" "}
        {item.title}
      </AppText>
      <AppText variant="caption" muted>
        {item.foods
          .map((food) => `${food.name} ${food.amount}${food.unit}`)
          .join("、")}
      </AppText>
      <AppText variant="caption" muted>
        能量 {formatNutrient(item.nutrients.energyKcal, "kcal")} · 碳水{" "}
        {formatNutrient(item.nutrients.carbohydrateG, "g")} · 水分{" "}
        {formatNutrient(item.nutrients.fluidMl, "ml")}
      </AppText>
      {item.notes ? (
        <AppText variant="caption" muted>
          {item.notes}
        </AppText>
      ) : null}
    </View>
  );
}

export function NutritionDraftReview({
  proposal,
  onEdit,
  busy,
}: {
  proposal: NutritionProposalResponse;
  onEdit?: (index: number) => void;
  busy?: boolean;
}) {
  const dates = [
    ...new Set(
      [...(proposal.original?.items ?? []), ...proposal.draft.items].map(
        (item) => item.localDate,
      ),
    ),
  ].sort();
  return (
    <View className="mt-4 gap-3">
      {dates.map((date) => (
        <View
          key={date}
          className="rounded-xl border border-border bg-surface-2 p-3"
        >
          <AppText variant="card" className="text-brand">
            {date}
          </AppText>
          <Disclosure
            title={`查看 ${date} 原安排`}
            summary={`${proposal.original?.items.filter((item) => item.localDate === date).length ?? 0} 个餐次`}
          >
            {proposal.original?.items
              .filter((item) => item.localDate === date)
              .map((item, index) => (
                <Meal key={index} item={item} />
              ))}
            {!proposal.original?.items.some(
              (item) => item.localDate === date,
            ) ? (
              <AppText variant="caption" muted>
                无已记录餐次
              </AppText>
            ) : null}
          </Disclosure>
          <AppText variant="caption" className="mt-4 text-brand">
            {proposal.status === "APPLIED" ? "已应用安排" : "建议安排"}
          </AppText>
          {!proposal.draft.items.some((item) => item.localDate === date) ? (
            <AppText variant="caption" muted>
              移除此日原餐次
            </AppText>
          ) : null}
          {proposal.draft.items.map((item, index) =>
            item.localDate === date ? (
              <View key={index}>
                <Meal item={item} />
                {onEdit &&
                ["DRAFT", "READY", "BLOCKED"].includes(proposal.status) ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onPress={() => onEdit(index)}
                  >
                    编辑 {item.title} 的份量和时间
                  </Button>
                ) : null}
              </View>
            ) : null,
          )}
        </View>
      ))}
    </View>
  );
}
