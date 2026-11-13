import { useState } from "react";
import { View } from "react-native";
import type {
  NutritionPlanResponse,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { NutritionMealCard } from "./NutritionMealCard";
import { NutritionItemEditor } from "./NutritionItemEditor";
import { nutritionApi } from "../services/nutrition.api";

type Item = NutritionPlanResponse["items"][number];
export function NutritionEditableMeals({
  plan,
  token,
  onSwap,
  onProposal,
  onError,
}: {
  plan: NutritionPlanResponse;
  token: string;
  onSwap: (item: Item) => void;
  onProposal: (proposal: NutritionProposalResponse) => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  return (
    <View className="gap-3">
      {plan.items.map((item) => (
        <NutritionMealCard
          key={item.id}
          item={item}
          onSwap={onSwap}
          onEdit={(item) => {
            setEditorError(null);
            setEditing(item);
          }}
        />
      ))}
      {editing ? (
        <NutritionItemEditor
          key={editing.id}
          item={{
            localDate: editing.localDate,
            mealType: editing.mealType,
            scheduledLocalTime: editing.scheduledLocalTime,
            title: editing.title,
            foods: editing.foods,
            nutrients: editing.nutrients,
            nutritionSource: editing.nutritionSource,
            confidence: editing.confidence,
            linkedWorkoutId: editing.linkedWorkoutId,
            notes: editing.notes,
          }}
          busy={busy}
          saveError={editorError}
          onClose={() => setEditing(null)}
          onSave={async (item) => {
            setBusy(true);
            setEditorError(null);
            try {
              onProposal(
                await nutritionApi.createItemEdit(token, {
                  itemId: editing.id,
                  expectedNutritionVersion: plan.version,
                  scheduledLocalTime: item.scheduledLocalTime,
                  amounts: item.foods.map((food) => food.amount),
                }),
              );
              return true;
            } catch (cause) {
              setEditorError(
                cause instanceof Error
                  ? cause.message
                  : "保存餐次草稿失败，请重试",
              );
              onError(
                cause instanceof Error
                  ? cause.message
                  : "保存餐次草稿失败，请重试",
              );
              return false;
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </View>
  );
}
