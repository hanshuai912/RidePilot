import { z } from "zod";
import {
  stageReviewEvidenceSchema,
  stageReviewSummarySchema,
} from "./stage-review";

export const stageDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  purpose: z.string().trim().min(1).max(300),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  assessmentSuggestion: z.string().trim().min(1).max(300),
});
export const stagePlanOutputSchema = z.strictObject({
  summary: z.string().trim().min(1).max(1000),
  stages: z.array(stageDraftSchema).min(1).max(12),
});
export const stagePlanGenerationSchema = z.strictObject({
  stageReviewId: z.uuid().optional(),
  goalId: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  forceRegenerate: z.boolean().optional(),
});
export const stagePlanResponseSchema = stagePlanOutputSchema.extend({
  stageReview: stageReviewEvidenceSchema.optional(),
  id: z.uuid(),
  goalId: z.uuid(),
  goalVersion: z.number().int().positive(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "SUPERSEDED"]),
  version: z.number().int().positive(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  stale: z.boolean(),
  stages: z.array(
    stageDraftSchema.extend({
      id: z.uuid(),
      position: z.number().int().nonnegative(),
      latestReview: stageReviewSummarySchema.nullable().optional(),
    }),
  ),
});
export const activateStagePlanSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
});
export const activeStagePlanResponseSchema = z.object({
  plan: stagePlanResponseSchema.nullable(),
});
export const rangeGenerationSchema = z.discriminatedUnion("scope", [
  z.strictObject({
    stageReviewId: z.uuid().optional(),
    scope: z.literal("STAGE"),
    goalId: z.uuid(),
    stageId: z.uuid(),
    expectedBaseVersion: z.number().int().nonnegative(),
    assessmentId: z.uuid().optional(),
    assessmentVersion: z.number().int().positive().optional(),
    notes: z.string().trim().max(200).optional(),
    forceRegenerate: z.boolean().optional(),
  }),
  z.strictObject({
    stageReviewId: z.uuid().optional(),
    scope: z.literal("DATES"),
    goalId: z.uuid(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    expectedBaseVersion: z.number().int().nonnegative(),
    assessmentId: z.uuid().optional(),
    assessmentVersion: z.number().int().positive().optional(),
    notes: z.string().trim().max(200).optional(),
    forceRegenerate: z.boolean().optional(),
  }),
]);
export type StagePlanGeneration = z.infer<typeof stagePlanGenerationSchema>;
export type StagePlanResponse = z.infer<typeof stagePlanResponseSchema>;
export type StagePlanOutput = z.infer<typeof stagePlanOutputSchema>;
export type RangeGeneration = z.infer<typeof rangeGenerationSchema>;
