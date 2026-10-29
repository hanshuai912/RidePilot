import { z } from "zod";

export const dietStyleSchema = z.enum([
  "OMNIVORE",
  "VEGETARIAN",
  "VEGAN",
  "PESCATARIAN",
]);

export const dietHabitSchema = z.enum([
  "EATING_OUT",
  "HOME_COOKING",
  "IRREGULAR_MEALS",
  "LIMITED_PREP_TIME",
]);

export const allergenSchema = z.enum([
  "MILK",
  "EGG",
  "PEANUT",
  "TREE_NUT",
  "WHEAT",
  "SOY",
  "FISH",
  "SHELLFISH",
  "SESAME",
]);

export const dietaryRestrictionSchema = z.enum([
  "NO_PORK",
  "NO_BEEF",
  "NO_ALCOHOL",
  "LOW_LACTOSE",
  "HALAL",
  "KOSHER",
  "OTHER",
]);

export const mealTypeSchema = z.enum([
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACK",
  "PRE_WORKOUT",
  "DURING_WORKOUT",
  "POST_WORKOUT",
]);

const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "请输入 HH:mm 格式的本地时间");

export const mealScheduleItemSchema = z.strictObject({
  mealType: mealTypeSchema,
  localTime: localTimeSchema,
});

const nutritionProfileBaseSchema = z.strictObject({
  dietStyle: dietStyleSchema,
  habits: z.array(dietHabitSchema).max(4),
  allergens: z.array(allergenSchema).max(9),
  restrictions: z.array(dietaryRestrictionSchema).max(7),
  restrictionNote: z.string().trim().max(200).nullable().optional(),
  commonFoods: z.array(z.string().trim().min(1).max(60)).max(30),
  mealSchedule: z.array(mealScheduleItemSchema).min(1).max(7),
  expectedVersion: z.number().int().positive().optional(),
});

export const nutritionProfileInputSchema =
  nutritionProfileBaseSchema.superRefine((value, context) => {
    if (
      value.restrictions.includes("OTHER") &&
      !value.restrictionNote?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["restrictionNote"],
        message: "选择其他限制时必须填写具体说明",
      });
    }
  });

export const nutritionProfileResponseSchema = nutritionProfileBaseSchema
  .omit({ expectedVersion: true })
  .extend({
    id: z.uuid(),
    version: z.number().int().positive(),
  });

export const ingredientStatusSchema = z.enum(["KNOWN", "PARTIAL", "UNKNOWN"]);
export const nutritionSourceSchema = z.enum([
  "CURATED",
  "LABEL",
  "USER_ENTERED",
  "AI_ESTIMATE",
]);
export const nutritionConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const nutritionFoodSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  amount: z.number().positive().max(10000),
  unit: z.enum(["g", "ml", "piece", "serving"]),
  allergenTags: z.array(allergenSchema).max(9),
  ingredientStatus: ingredientStatusSchema,
});

export const nutritionNutrientsSchema = z.strictObject({
  energyKcal: z.number().nonnegative().nullable(),
  carbohydrateG: z.number().nonnegative().nullable(),
  proteinG: z.number().nonnegative().nullable(),
  fatG: z.number().nonnegative().nullable(),
  fluidMl: z.number().nonnegative().nullable(),
  sodiumMg: z.number().nonnegative().nullable(),
});

export const nutritionItemDraftSchema = z.strictObject({
  localDate: z.iso.date(),
  mealType: mealTypeSchema,
  scheduledLocalTime: localTimeSchema,
  title: z.string().trim().min(1).max(120),
  foods: z.array(nutritionFoodSchema).min(1).max(30),
  nutrients: nutritionNutrientsSchema,
  nutritionSource: nutritionSourceSchema,
  confidence: nutritionConfidenceSchema,
  linkedWorkoutId: z.uuid().nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});

export const nutritionItemSchema = nutritionItemDraftSchema.extend({
  id: z.uuid(),
  warnings: z.array(z.string()),
});

export const dailyNutritionTargetSchema = z.strictObject({
  energyKcal: z.number().nonnegative().nullable(),
  carbohydrateG: z.number().nonnegative().nullable(),
  proteinG: z.number().nonnegative().nullable(),
  fatG: z.number().nonnegative().nullable(),
  basis: z.enum(["ESTIMATE", "USER_ENTERED", "LABEL"]),
  confidence: nutritionConfidenceSchema,
});

export const nutritionPlanDraftSchema = z.strictObject({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  dailyTarget: dailyNutritionTargetSchema.nullable().optional(),
  items: z.array(nutritionItemDraftSchema).min(1).max(200),
});

export const nutritionPlanResponseSchema = z.strictObject({
  planId: z.uuid().nullable(),
  version: z.number().int().nonnegative(),
  status: z.enum(["NOT_GENERATED", "ACTIVE"]),
  timezone: z.string(),
  from: z.iso.date(),
  to: z.iso.date(),
  dailyTarget: dailyNutritionTargetSchema.nullable(),
  items: z.array(nutritionItemSchema),
});

export const nutritionPlanQuerySchema = z
  .strictObject({
    date: z.iso.date().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .superRefine((value, context) => {
    if (!value.date && (!value.from || !value.to)) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "请提供 date 或 from/to",
      });
    }
    if (value.date && (value.from || value.to)) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "date 不能与 from/to 同时使用",
      });
    }
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "to 不能早于 from",
      });
    }
  });

export const createNutritionPlanProposalSchema = z.strictObject({
  expectedNutritionVersion: z.number().int().nonnegative().optional(),
  draft: nutritionPlanDraftSchema,
});

export const nutritionMealSwapReasonSchema = z.enum([
  "DISLIKE",
  "MISSING_INGREDIENT",
  "EATING_OUT",
  "LIMITED_PREP_TIME",
  "TRAINING_CHANGED",
]);

export const createNutritionMealSwapProposalSchema = z.strictObject({
  itemId: z.uuid(),
  reason: nutritionMealSwapReasonSchema,
  replacement: nutritionItemDraftSchema,
  expectedNutritionVersion: z.number().int().positive(),
});

export const updateNutritionProposalSchema = z.strictObject({
  expectedProposalVersion: z.number().int().positive(),
  draft: nutritionPlanDraftSchema,
});

export const validateNutritionProposalResponseSchema = z.strictObject({
  passed: z.boolean(),
  warnings: z.array(z.string()),
  blockers: z.array(z.string()),
});

export const nutritionProposalMetadataSchema = z.strictObject({
  summary: z.string(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  blockers: z.array(z.string()),
  sourceRefs: z.array(z.string()),
  confidence: nutritionConfidenceSchema,
  model: z.string(),
  skillVersion: z.string(),
  skillHash: z.string(),
});

export const nutritionProposalResponseSchema = z.strictObject({
  proposalId: z.uuid(),
  proposalType: z.enum(["PLAN_CREATE", "MEAL_SWAP", "ITEM_EDIT", "AI_PLAN"]),
  status: z.enum([
    "DRAFT",
    "READY",
    "BLOCKED",
    "APPLIED",
    "REJECTED",
    "EXPIRED",
  ]),
  baseNutritionVersion: z.number().int().nonnegative(),
  proposalVersion: z.number().int().positive(),
  original: nutritionPlanDraftSchema.nullable(),
  draft: nutritionPlanDraftSchema,
  validation: validateNutritionProposalResponseSchema,
  metadata: nutritionProposalMetadataSchema.nullable(),
});

export const applyNutritionProposalSchema = z.strictObject({
  expectedNutritionVersion: z.number().int().nonnegative(),
});

export const applyNutritionProposalResponseSchema = z.strictObject({
  success: z.literal(true),
  newNutritionVersion: z.number().int().positive(),
  affectedDates: z.array(z.iso.date()),
});

export const nutritionGenerationInputSchema = z.strictObject({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  mode: z.enum(["INITIAL", "REGENERATE", "TRAINING_LINKED", "RACE_LINKED"]),
  expectedNutritionVersion: z.number().int().nonnegative(),
  expectedTrainingPlanVersion: z.number().int().nonnegative().optional(),
  workoutId: z.uuid().optional(),
  trainingProposalId: z.uuid().optional(),
  raceId: z.uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const nutritionLinkedGenerationRequestSchema = z.strictObject({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  expectedNutritionVersion: z.number().int().nonnegative(),
  expectedTrainingPlanVersion: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const nutritionAiOutputSchema = z.strictObject({
  summary: z.string().trim().min(1).max(1000),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(20),
  draft: nutritionPlanDraftSchema,
  warnings: z.array(z.string().trim().min(1).max(300)).max(30),
  blockers: z.array(z.string().trim().min(1).max(300)).max(30),
  sourceRefs: z.array(z.string().trim().min(1).max(200)).max(20),
  confidence: nutritionConfidenceSchema,
});

export type NutritionProfileInput = z.infer<typeof nutritionProfileInputSchema>;
export type NutritionProfileResponse = z.infer<
  typeof nutritionProfileResponseSchema
>;
export type NutritionItemDraft = z.infer<typeof nutritionItemDraftSchema>;
export type NutritionPlanDraft = z.infer<typeof nutritionPlanDraftSchema>;
export type NutritionPlanResponse = z.infer<typeof nutritionPlanResponseSchema>;
export type NutritionPlanQuery = z.infer<typeof nutritionPlanQuerySchema>;
export type CreateNutritionPlanProposal = z.infer<
  typeof createNutritionPlanProposalSchema
>;
export type CreateNutritionMealSwapProposal = z.infer<
  typeof createNutritionMealSwapProposalSchema
>;
export type UpdateNutritionProposal = z.infer<
  typeof updateNutritionProposalSchema
>;
export type NutritionProposalResponse = z.infer<
  typeof nutritionProposalResponseSchema
>;
export type ApplyNutritionProposal = z.infer<
  typeof applyNutritionProposalSchema
>;
export type ApplyNutritionProposalResponse = z.infer<
  typeof applyNutritionProposalResponseSchema
>;
export type NutritionGenerationInput = z.infer<
  typeof nutritionGenerationInputSchema
>;
export type NutritionLinkedGenerationRequest = z.infer<
  typeof nutritionLinkedGenerationRequestSchema
>;
export type NutritionAiOutput = z.infer<typeof nutritionAiOutputSchema>;
