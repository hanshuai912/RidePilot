import { View } from "react-native";
import type { NutritionProfileInput } from "@ridepilot/contracts";
import { AppText, Input } from "../../../components/ui";
import {
  allergenLabels,
  dietStyleLabels,
  habitLabels,
  restrictionLabels,
} from "../model/nutrition";
import { NutritionChoiceGroup } from "./NutritionChoiceGroup";
import { NutritionRoutineFields } from "./NutritionRoutineFields";

/** Shared by onboarding and the nutrition tab; always keeps the full profile. */
export function NutritionProfileForm({
  value,
  onChange,
  disabled = false,
}: {
  value: NutritionProfileInput;
  onChange: (value: NutritionProfileInput) => void;
  disabled?: boolean;
}) {
  const other = value.restrictions.includes("OTHER");
  return (
    <View className="gap-6">
      <NutritionChoiceGroup
        title="饮食方式"
        description="选择最符合日常饮食的一项。"
        labels={dietStyleLabels}
        selected={[value.dietStyle]}
        disabled={disabled}
        onChange={([dietStyle]) => onChange({ ...value, dietStyle })}
      />
      <NutritionChoiceGroup
        title="日常习惯"
        description="可多选，帮助安排更容易执行的餐食。"
        labels={habitLabels}
        selected={value.habits}
        multiple
        disabled={disabled}
        onChange={(habits) => onChange({ ...value, habits })}
      />
      <NutritionChoiceGroup
        title="需要避开的过敏原"
        description="可多选，生成餐食与补给时会按这些信息校验。"
        labels={allergenLabels}
        selected={value.allergens}
        multiple
        compact
        noneLabel="无已知过敏"
        disabled={disabled}
        onChange={(allergens) => onChange({ ...value, allergens })}
      />
      <View className="gap-3">
        <NutritionChoiceGroup
          title="饮食禁忌与限制"
          description="可多选，可与上方的过敏原同时设置。"
          labels={restrictionLabels}
          selected={value.restrictions}
          multiple
          compact
          noneLabel="无额外限制"
          disabled={disabled}
          onChange={(restrictions) => onChange({ ...value, restrictions })}
        />
        <View className="gap-2">
          <AppText variant="caption" className="text-secondary">
            {other ? "其他限制说明（必填）" : "补充说明（选填）"}
          </AppText>
          <Input
            accessibilityLabel="其他饮食限制"
            accessibilityHint={
              other
                ? "选择其他限制时，请填写具体食物或成分"
                : "可补充饮食偏好或需避开的成分"
            }
            value={value.restrictionNote ?? ""}
            onChangeText={(restrictionNote) =>
              onChange({ ...value, restrictionNote })
            }
            editable={!disabled}
            maxLength={200}
            multiline
            textAlignVertical="top"
            className="min-h-24 py-3"
            placeholder="例如：对虾类过敏；避免辛辣食物"
          />
          <AppText variant="caption" className="text-secondary">
            最多 200 字。
          </AppText>
        </View>
      </View>
      <View className="border-t border-divider pt-2">
        <NutritionRoutineFields
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </View>
    </View>
  );
}
