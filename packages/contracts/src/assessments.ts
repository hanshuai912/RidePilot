import { z } from "zod";

export const assessmentKindSchema = z.enum([
  "FTP",
  "POWER_DURATION",
  "FIXED_ROUTE",
  "LEGACY",
]);
export const assessmentStatusSchema = z.enum([
  "SCHEDULED",
  "POSTPONED",
  "COMPLETED",
  "INCOMPLETE",
  "SKIPPED",
  "INVALID",
]);
export const assessmentSourceSchema = z.enum([
  "TRAINER",
  "POWER_METER",
  "DEVICE_REPORT",
  "MANUAL",
]);
export const assessmentScheduleSchema = z.strictObject({
  goalId: z.uuid(),
  stageId: z.uuid().nullable().optional(),
  localDate: z.iso.date(),
  kind: z.enum(["FTP", "POWER_DURATION", "FIXED_ROUTE"]),
  protocol: z.string().trim().min(1).max(64),
});
export const assessmentPreviewInputSchema = assessmentScheduleSchema.extend({
  excludeId: z.uuid().optional(),
});
export const assessmentPreviewSchema = z.object({
  token: z.string(),
  conflicts: z.array(
    z.object({
      id: z.uuid(),
      type: z.enum(["WORKOUT", "RACE", "ASSESSMENT"]),
      title: z.string(),
    }),
  ),
});
export const assessmentInputSchema = assessmentScheduleSchema.extend({
  previewToken: z.string().min(1),
  acknowledgeConflicts: z.boolean(),
});
export const assessmentPatchSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  status: z.enum([
    "COMPLETED",
    "POSTPONED",
    "SKIPPED",
    "INVALID",
    "INCOMPLETE",
  ]),
  localDate: z.iso.date().optional(),
  previewToken: z.string().optional(),
  acknowledgeConflicts: z.boolean().optional(),
  protocol: z.string().trim().min(1).max(64).optional(),
  actualDate: z.iso.date().optional(),
  resultWatts: z.number().int().min(1).max(2500).nullable().optional(),
  durationSeconds: z.number().int().min(1).max(86400).nullable().optional(),
  routeName: z.string().trim().max(120).nullable().optional(),
  distanceKm: z.number().positive().max(2000).nullable().optional(),
  source: assessmentSourceSchema.nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  conditions: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  reason: z.string().trim().max(200).nullable().optional(),
  comparableConditions: z.boolean().optional(),
});
export const assessmentSchema = z.object({
  id: z.uuid(),
  goalId: z.uuid().nullable(),
  stageId: z.uuid().nullable(),
  localDate: z.iso.date(),
  actualDate: z.iso.date().nullable(),
  kind: assessmentKindSchema,
  protocol: z.string(),
  status: assessmentStatusSchema,
  resultWatts: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  routeName: z.string().nullable(),
  distanceKm: z.number().nullable(),
  source: assessmentSourceSchema.nullable(),
  rpe: z.number().nullable(),
  conditions: z.string().nullable(),
  notes: z.string().nullable(),
  reason: z.string().nullable(),
  comparableConditions: z.boolean(),
  baselineFtpWatts: z.number().nullable(),
  ftpMeasurementId: z.uuid().nullable(),
  version: z.number().int().positive(),
});
export const assessmentFtpInputSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  expectedFtpId: z.uuid().nullable(),
});
export const assessmentReviewSchema = z.object({
  assessment: assessmentSchema,
  goalTitle: z.string().nullable(),
  stageTitle: z.string().nullable(),
  currentFtp: z
    .object({
      id: z.uuid(),
      valueWatts: z.number(),
      measuredAt: z.iso.datetime(),
    })
    .nullable(),
  previous: assessmentSchema.nullable(),
  comparison: z
    .object({
      wattsDelta: z.number().nullable(),
      secondsDelta: z.number().nullable(),
    })
    .nullable(),
  training: z
    .object({
      startDate: z.iso.date(),
      endDate: z.iso.date(),
      total: z.number(),
      completed: z.number(),
      partial: z.number(),
      skipped: z.number(),
      unrecorded: z.number(),
    })
    .nullable(),
  canUpdateFtp: z.boolean(),
  messages: z.array(z.string()),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export type AssessmentSchedule = z.infer<typeof assessmentScheduleSchema>;
export type AssessmentPreviewInput = z.infer<
  typeof assessmentPreviewInputSchema
>;
export type AssessmentPreview = z.infer<typeof assessmentPreviewSchema>;
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type AssessmentPatch = z.infer<typeof assessmentPatchSchema>;
export type AssessmentFtpInput = z.infer<typeof assessmentFtpInputSchema>;
export type AssessmentReview = z.infer<typeof assessmentReviewSchema>;
