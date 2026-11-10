import { z } from "zod";
import { workoutSummarySchema } from "./training";

export const planImpactReferenceSchema = z.strictObject({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});
export const planImpactIssueSchema = z.enum(["FTP", "AVAILABILITY", "GOAL"]);
export const planImpactItemSchema = z.object({
  workout: workoutSummarySchema,
  issues: z.array(planImpactIssueSchema),
  messages: z.array(z.string()),
  oldFtpWatts: z.number().positive().nullable(),
  recalculable: z.boolean(),
  power: z.array(
    z.object({
      before: z.string(),
      after: z.string(),
    }),
  ),
});
export const planImpactPreviewSchema = z.object({
  fingerprint: z.string(),
  localDate: z.iso.date(),
  basePlanVersion: z.number().int().nonnegative(),
  currentFtpWatts: z.number().positive().nullable(),
  goalId: z.uuid().nullable(),
  goalDescription: z.string().nullable(),
  goalTargetDate: z.iso.date().nullable(),
  stageMessages: z.array(z.string()),
  items: z.array(planImpactItemSchema),
  protectedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  decisions: z.array(
    z.object({
      id: z.uuid(),
      action: z.enum(["KEEP", "FTP_RECALCULATE"]),
      status: z.enum(["DRAFT", "APPLIED"]),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
      createdAt: z.iso.datetime(),
    }),
  ),
  generations: z.array(
    z.object({
      id: z.uuid(),
      status: z.enum(["QUEUED", "RUNNING", "READY", "FAILED", "CANCELLED"]),
      proposalId: z.uuid().nullable(),
      startDate: z.iso.date(),
      endDate: z.iso.date(),
    }),
  ),
});
export const planImpactDecisionSchema = z.strictObject({
  ...planImpactReferenceSchema.shape,
  action: z.enum(["KEEP", "FTP_RECALCULATE"]),
});
export const planImpactDecisionResponseSchema = z.object({
  id: z.uuid(),
  action: z.enum(["KEEP", "FTP_RECALCULATE"]),
  status: z.enum(["DRAFT", "APPLIED"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  basePlanVersion: z.number().int().nonnegative(),
  items: z.array(planImpactItemSchema),
  newPlanVersion: z.number().int().positive().nullable(),
});
export type PlanImpactReference = z.infer<typeof planImpactReferenceSchema>;
export type PlanImpactPreview = z.infer<typeof planImpactPreviewSchema>;
export type PlanImpactItem = z.infer<typeof planImpactItemSchema>;
export type PlanImpactDecision = z.infer<typeof planImpactDecisionSchema>;
export type PlanImpactDecisionResponse = z.infer<
  typeof planImpactDecisionResponseSchema
>;
