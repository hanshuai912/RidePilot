import { z } from "zod";

const coachEventSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  title: z.string(),
});
export const coachOverviewSchema = z.object({
  localDate: z.iso.date(),
  timezone: z.string(),
  planVersion: z.number().int().nonnegative(),
  goal: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  stage: z
    .object({
      id: z.uuid(),
      title: z.string(),
      purpose: z.string(),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
      upcoming: z.boolean(),
    })
    .nullable(),
  stageNotice: z.string().nullable(),
  status: z.object({
    code: z.enum(["INSUFFICIENT", "STABLE", "RECOVERING", "REASSESS"]),
    label: z.string(),
    explanation: z.string(),
    evidence: z.array(
      coachEventSchema.extend({
        kind: z.enum(["ACTIVITY", "RACE", "ASSESSMENT"]),
        detail: z.string(),
      }),
    ),
  }),
  nextWorkout: coachEventSchema
    .extend({ minutes: z.number().nullable() })
    .nullable(),
  upcomingWorkouts: z
    .array(
      coachEventSchema.extend({
        minutes: z.number().nullable(),
        purpose: z.string().nullable(),
      }),
    )
    .max(14),
  nextAssessment: coachEventSchema.extend({ overdue: z.boolean() }).nullable(),
  versions: z.array(
    z.object({
      id: z.uuid(),
      version: z.number().int().positive(),
      reason: z.string().nullable(),
      appliedAt: z.iso.datetime().nullable(),
      active: z.boolean(),
    }),
  ),
});

export const coachSuggestionKindSchema = z.enum([
  "TRAINING",
  "NUTRITION",
  "STAGE",
  "GENERATION",
]);
export const coachSuggestionSchema = z.object({
  id: z.uuid(),
  kind: coachSuggestionKindSchema,
  title: z.string(),
  summary: z.string(),
  status: z.string(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  staleReason: z.string().nullable(),
  goalId: z.uuid().nullable(),
});
export const coachSuggestionsSchema = z.object({
  pending: z.array(coachSuggestionSchema),
  recent: z.array(coachSuggestionSchema),
});
export const dismissCoachSuggestionSchema = z.strictObject({
  kind: z.enum(["TRAINING", "NUTRITION", "STAGE"]),
  expectedVersion: z.number().int().positive(),
});
export const dismissCoachSuggestionResponseSchema = z.object({
  dismissed: z.literal(true),
});
export type CoachOverview = z.infer<typeof coachOverviewSchema>;
export type CoachSuggestion = z.infer<typeof coachSuggestionSchema>;
export type CoachSuggestions = z.infer<typeof coachSuggestionsSchema>;
export type DismissCoachSuggestion = z.infer<
  typeof dismissCoachSuggestionSchema
>;
