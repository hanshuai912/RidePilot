import type {
  NutritionPlanResponse,
  NutritionProfileInput,
  NutritionProfileResponse,
} from "@ridepilot/contracts";

type NutritionItem = NutritionPlanResponse["items"][number];

export const mealTypeLabels: Record<NutritionItem["mealType"], string> = {
  BREAKFAST: "早餐",
  LUNCH: "午餐",
  DINNER: "晚餐",
  SNACK: "加餐",
  PRE_WORKOUT: "训练前",
  DURING_WORKOUT: "训练中",
  POST_WORKOUT: "训练后",
};

export const dietStyleLabels: Record<NutritionProfileInput["dietStyle"], string> = {
  OMNIVORE: "均衡饮食",
  VEGETARIAN: "素食",
  VEGAN: "纯植物",
  PESCATARIAN: "鱼素",
};

export const habitLabels: Record<NutritionProfileInput["habits"][number], string> = {
  EATING_OUT: "经常外食",
  HOME_COOKING: "主要下厨",
  IRREGULAR_MEALS: "用餐不规律",
  LIMITED_PREP_TIME: "准备时间少",
};

export const allergenLabels: Record<NutritionProfileInput["allergens"][number], string> = {
  MILK: "乳制品",
  EGG: "蛋类",
  PEANUT: "花生",
  TREE_NUT: "坚果",
  WHEAT: "小麦",
  SOY: "大豆",
  FISH: "鱼类",
  SHELLFISH: "贝类",
  SESAME: "芝麻",
};

export const restrictionLabels: Record<
  NutritionProfileInput["restrictions"][number],
  string
> = {
  NO_PORK: "不吃猪肉",
  NO_BEEF: "不吃牛肉",
  NO_ALCOHOL: "不含酒精",
  LOW_LACTOSE: "低乳糖",
  HALAL: "清真",
  KOSHER: "犹太洁食",
  OTHER: "其他限制",
};

export const defaultNutritionProfile: NutritionProfileInput = {
  dietStyle: "OMNIVORE",
  habits: ["HOME_COOKING"],
  allergens: [],
  restrictions: [],
  restrictionNote: null,
  commonFoods: [],
  mealSchedule: [
    { mealType: "BREAKFAST", localTime: "08:00" },
    { mealType: "LUNCH", localTime: "12:00" },
    { mealType: "DINNER", localTime: "18:30" },
  ],
};

export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatNutrient(value: number | null, unit: string): string {
  return value === null ? "待估算" : `${Math.round(value)} ${unit}`;
}

export function profileInputFromResponse(
  profile: NutritionProfileResponse,
): NutritionProfileInput {
  return {
    dietStyle: profile.dietStyle,
    habits: profile.habits,
    allergens: profile.allergens,
    restrictions: profile.restrictions,
    restrictionNote: profile.restrictionNote,
    commonFoods: profile.commonFoods,
    mealSchedule: profile.mealSchedule,
    expectedVersion: profile.version,
  };
}
