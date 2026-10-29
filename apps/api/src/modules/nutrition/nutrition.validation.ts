import {
  NutritionPlanDraft,
  NutritionProfileResponse,
} from "@ridepilot/contracts";

export type NutritionValidationResult = {
  warnings: string[];
  blockers: string[];
};

export function validateNutritionDraft(
  draft: NutritionPlanDraft,
  profile: NutritionProfileResponse,
): NutritionValidationResult {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const allergens = new Set(profile.allergens);
  const restrictions = new Set(profile.restrictions);

  if (draft.startDate > draft.endDate)
    blockers.push("计划开始日期不能晚于结束日期");

  for (const [index, item] of draft.items.entries()) {
    if (item.localDate < draft.startDate || item.localDate > draft.endDate)
      blockers.push(`第 ${index + 1} 个餐次日期不在计划范围内`);

    for (const food of item.foods) {
      const conflict = food.allergenTags.find((tag) => allergens.has(tag));
      if (conflict)
        blockers.push(`第 ${index + 1} 个餐次含有已声明过敏原 ${conflict}`);
      if (food.ingredientStatus === "UNKNOWN")
        blockers.push(`第 ${index + 1} 个餐次存在成分未知的食材`);
    }

    if (restrictions.has("OTHER") && !profile.restrictionNote?.trim()) {
      blockers.push("其他饮食限制缺少具体说明");
    }
  }

  if (draft.items.some((item) => item.confidence === "LOW"))
    warnings.push("部分营养数值为低置信度估算，请结合食品标签核对");
  if (draft.items.some((item) => item.nutritionSource === "AI_ESTIMATE"))
    warnings.push("部分营养数值来自估算，不代表精确测量结果");

  return { warnings, blockers };
}
