import { z } from "zod";

export const stageOutcomeSchema = z.enum(["MET", "NOT_MET", "INSUFFICIENT"]);
export const stageDecisionSchema = z.enum(["KEEP", "EXTEND", "ADJUST", "NEXT"]);
export const stageReviewSnapshotSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  localDate: z.iso.date(),
  goalId: z.uuid(),
  goalVersion: z.number().int().positive(),
  goalStatus: z.string(),
  goalTargetDate: z.iso.date(),
  stageId: z.uuid(),
  stagePlanId: z.uuid(),
  stagePlanVersion: z.number().int().positive(),
  stageTitle: z.string(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  criteria: z.string().nullable(),
  criteriaVersion: z.number().int().positive(),
  stale: z.boolean(),
  nextStage: z
    .object({
      id: z.uuid(),
      title: z.string(),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
    })
    .nullable(),
  training: z.object({
    planned: z.number(),
    completed: z.number(),
    partial: z.number(),
    skipped: z.number(),
    unrecorded: z.number(),
    actualMinutes: z.number().nullable(),
  }),
  tests: z.array(
    z.object({
      id: z.uuid(),
      version: z.number().int(),
      date: z.iso.date(),
      protocol: z.string(),
      status: z.string(),
      source: z.string().nullable(),
      watts: z.number().nullable(),
      seconds: z.number().nullable(),
      valid: z.boolean(),
    }),
  ),
  notices: z.array(z.string()),
});
export const stageReviewSummarySchema = z.object({
  id: z.uuid(),
  stageId: z.uuid(),
  outcome: stageOutcomeSchema,
  decision: stageDecisionSchema,
  rationale: z.string(),
  createdAt: z.iso.datetime(),
});
export const stageReviewEvidenceSchema = stageReviewSummarySchema.extend({
  snapshot: stageReviewSnapshotSchema,
});
export const stageReviewFollowupSchema = z.object({
  generationId: z.uuid(),
  reviewId: z.uuid(),
  kind: z.enum(["STAGES", "COURSES"]),
  status: z.enum(["QUEUED", "RUNNING", "READY", "FAILED"]),
  proposalId: z.uuid().nullable(),
  errorCode: z.string().nullable(),
});
export const stageReviewStateSchema = z.object({
  snapshot: stageReviewSnapshotSchema,
  history: z.array(stageReviewEvidenceSchema),
  followups: z.array(stageReviewFollowupSchema).optional(),
});
export const stageCriteriaInputSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  criteria: z.string().trim().min(1).max(300),
});
export const stageReviewInputSchema = z.strictObject({
  expectedReviewId: z.uuid().nullable(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  outcome: stageOutcomeSchema,
  decision: stageDecisionSchema,
  rationale: z.string().trim().min(1).max(500),
});
export type StageReviewSnapshot = z.infer<typeof stageReviewSnapshotSchema>;
export type StageReviewEvidence = z.infer<typeof stageReviewEvidenceSchema>;
export type StageReviewState = z.infer<typeof stageReviewStateSchema>;
export type StageReviewInput = z.infer<typeof stageReviewInputSchema>;

export type StageReviewFollowup = z.infer<typeof stageReviewFollowupSchema>;
