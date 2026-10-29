import { nutritionProfileResponseSchema } from "@ridepilot/contracts";
import { validateNutritionDraft } from "../src/modules/nutrition/nutrition.validation";

const profile = nutritionProfileResponseSchema.parse({
  id: "00000000-0000-4000-8000-000000000001",
  dietStyle: "OMNIVORE",
  habits: [],
  allergens: ["PEANUT"],
  restrictions: [],
  restrictionNote: null,
  commonFoods: ["米饭"],
  mealSchedule: [{ mealType: "BREAKFAST", localTime: "07:30" }],
  version: 1,
});

const item = {
  localDate: "2030-01-01",
  mealType: "BREAKFAST" as const,
  scheduledLocalTime: "07:30",
  title: "早餐",
  foods: [
    {
      name: "燕麦",
      amount: 60,
      unit: "g" as const,
      allergenTags: [],
      ingredientStatus: "KNOWN" as const,
    },
  ],
  nutrients: {
    energyKcal: 220,
    carbohydrateG: 35,
    proteinG: 8,
    fatG: 5,
    fluidMl: null,
    sodiumMg: null,
  },
  nutritionSource: "CURATED" as const,
  confidence: "HIGH" as const,
  linkedWorkoutId: null,
  notes: null,
};

describe("nutrition validation", () => {
  it("blocks a declared allergen and unknown ingredients", () => {
    const result = validateNutritionDraft(
      {
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        dailyTarget: null,
        items: [
          {
            ...item,
            foods: [
              {
                ...item.foods[0],
                name: "花生酱",
                allergenTags: ["PEANUT"],
                ingredientStatus: "KNOWN",
              },
              {
                ...item.foods[0],
                name: "复合代餐",
                allergenTags: [],
                ingredientStatus: "UNKNOWN",
              },
            ],
          },
        ],
      },
      profile,
    );
    expect(result.blockers).toHaveLength(2);
    expect(result.blockers.join(" ")).toContain("PEANUT");
    expect(result.blockers.join(" ")).toContain("成分未知");
  });

  it("warns about estimated nutrition without blocking it", () => {
    const result = validateNutritionDraft(
      {
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        dailyTarget: null,
        items: [{ ...item, nutritionSource: "AI_ESTIMATE", confidence: "LOW" }],
      },
      profile,
    );
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(2);
  });
});
