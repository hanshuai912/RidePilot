import { useState } from "react";
import { View } from "react-native";
import type { NutritionProfileInput } from "@ridepilot/contracts";
import { AppText, Disclosure, Input } from "../../../components/ui";
import { mealTypeLabels } from "../model/nutrition";

const foodsFromText = (value: string) =>
  value
    .split(/[,，、\n]/)
    .map((food) => food.trim())
    .filter(Boolean);

export function NutritionRoutineFields({
  value,
  onChange,
  disabled,
}: {
  value: NutritionProfileInput;
  onChange: (value: NutritionProfileInput) => void;
  disabled: boolean;
}) {
  const canonical = value.commonFoods.join("、");
  const [foodDraft, setFoodDraft] = useState({ canonical, text: canonical });
  const foods = foodDraft.canonical === canonical ? foodDraft.text : canonical;
  return (
    <Disclosure
      title="常吃食物与用餐时间"
      summary="选填，可展开调整；已保存的信息会保留。"
      keepMounted
    >
      <View className="gap-2">
        <AppText variant="caption" className="text-secondary">
          常吃的食物（用逗号分隔，最多 30 项）
        </AppText>
        <Input
          accessibilityLabel="常吃的食物"
          value={foods}
          editable={!disabled}
          multiline
          className="min-h-20 py-3"
          maxLength={1800}
          placeholder="例如：米饭、燕麦、鸡蛋"
          onChangeText={(text) => {
            const commonFoods = foodsFromText(text);
            setFoodDraft({ canonical: commonFoods.join("、"), text });
            onChange({ ...value, commonFoods });
          }}
        />
      </View>
      <AppText variant="caption" className="text-secondary">
        日常用餐时间（当地时间，HH:mm）
      </AppText>
      <View className="gap-3">
        {value.mealSchedule.map((meal, index) => (
          <View
            key={`${meal.mealType}-${index}`}
            className="flex-row items-center gap-3"
          >
            <AppText className="min-w-0 flex-1">
              {mealTypeLabels[meal.mealType]}
            </AppText>
            <Input
              accessibilityLabel={`${mealTypeLabels[meal.mealType]}时间`}
              value={meal.localTime}
              editable={!disabled}
              className="w-28 text-center"
              maxLength={5}
              autoCapitalize="none"
              placeholder="08:00"
              onChangeText={(localTime) =>
                onChange({
                  ...value,
                  mealSchedule: value.mealSchedule.map((entry, at) =>
                    at === index ? { ...entry, localTime } : entry,
                  ),
                })
              }
            />
          </View>
        ))}
      </View>
    </Disclosure>
  );
}
