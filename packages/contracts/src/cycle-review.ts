import { z } from "zod";

export const cycleReviewRangeSchema = z.strictObject({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});
export const cycleReviewActionSchema = z.enum([
  "CONTINUE",
  "RECOVERY",
  "ADJUST",
]);
export const cycleReviewReferenceSchema = cycleReviewRangeSchema.extend({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  action: cycleReviewActionSchema,
});
const feedbackSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  status: z.enum(["COMPLETED", "PARTIAL", "SKIPPED"]),
  durationMin: z.number().nonnegative().nullable(),
  rpe: z.number().nullable(),
  fatigue: z.number().nullable(),
  notes: z.string().nullable(),
});
export const cycleReviewSnapshotSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  localDate: z.iso.date(),
  timezone: z.string(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  planVersion: z.number().int().nonnegative(),
  goal: z
    .object({ id: z.uuid(), title: z.string(), targetDate: z.iso.date() })
    .nullable(),
  stage: z
    .object({
      title: z.string(),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
    })
    .nullable(),
  missingFields: z.array(z.string()),
  stats: z.object({
    planned: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    unrecorded: z.number().int().nonnegative(),
    completionRate: z.number().min(0).max(100).nullable(),
    plannedMinutes: z.number().nonnegative().nullable(),
    plannedDurationCount: z.number().int().nonnegative(),
    actualMinutes: z.number().nonnegative().nullable(),
    actualDurationCount: z.number().int().nonnegative(),
    pairedMinutesDelta: z.number().nullable(),
    pairedDurationCount: z.number().int().nonnegative(),
    rpeAverage: z.number().nullable(),
    rpeCount: z.number().int().nonnegative(),
    fatigueAverage: z.number().nullable(),
    fatigueCount: z.number().int().nonnegative(),
    additionalRecords: z.number().int().nonnegative(),
  }),
  workouts: z.array(
    z.object({
      id: z.uuid(),
      date: z.iso.date(),
      title: z.string(),
      plannedMinutes: z.number().nullable(),
      inCurrentPlan: z.boolean(),
      canRecord: z.boolean(),
      feedback: feedbackSchema.nullable(),
    }),
  ),
  additionalFeedback: z.array(feedbackSchema),
  recentFeedback: z.array(feedbackSchema),
  tests: z.array(
    z.object({
      id: z.uuid(),
      date: z.iso.date(),
      title: z.string(),
      status: z.string(),
      watts: z.number().nullable(),
    }),
  ),
  ftp: z
    .object({
      valueWatts: z.number(),
      measuredAt: z.iso.datetime(),
      source: z.string(),
      previousWatts: z.number().nullable(),
      previousMeasuredAt: z.iso.datetime().nullable(),
      deltaWatts: z.number().nullable(),
    })
    .nullable(),
  recommendation: z.object({
    code: z.enum([
      "INSUFFICIENT",
      "RECOVERY",
      "ADJUST",
      "REASSESS",
      "CONTINUE",
    ]),
    label: z.string(),
    reasons: z.array(z.string()),
  }),
  notices: z.array(z.string()),
});
export const cycleReviewEvidenceSchema = z.object({
  action: cycleReviewActionSchema,
  snapshot: cycleReviewSnapshotSchema,
});
export const cycleReviewGenerationSchema = z.strictObject({
  review: cycleReviewReferenceSchema,
  goalId: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  expectedBaseVersion: z.number().int().nonnegative(),
  notes: z.string().trim().max(200).optional(),
  forceRegenerate: z.boolean().optional(),
});
export const cycleReviewHistorySchema = z.object({
  items: z.array(
    z.object({
      generationId: z.uuid(),
      proposalId: z.uuid().nullable(),
      createdAt: z.iso.datetime(),
      status: z.string(),
      errorCode: z.string().nullable(),
      review: cycleReviewReferenceSchema,
      startDate: z.iso.date(),
      endDate: z.iso.date(),
      appliedPlanVersion: z.number().int().positive().nullable(),
      evidence: cycleReviewEvidenceSchema.nullable(),
    }),
  ),
});
export type CycleReviewSnapshot = z.infer<typeof cycleReviewSnapshotSchema>;
export type CycleReviewReference = z.infer<typeof cycleReviewReferenceSchema>;
export type CycleReviewGeneration = z.infer<typeof cycleReviewGenerationSchema>;
export type CycleReviewEvidence = z.infer<typeof cycleReviewEvidenceSchema>;
export type CycleReviewHistory = z.infer<typeof cycleReviewHistorySchema>;
