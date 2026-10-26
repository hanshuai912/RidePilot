import { z } from "zod";
import { workoutSegmentSchema } from "./training";

export const ftpMeasurementInputSchema = z.strictObject({
  valueWatts: z.number().int().min(50).max(800),
  measuredAt: z.iso.datetime({ offset: true }),
  source: z.enum(["MANUAL", "TEST"]),
});
export const ftpMeasurementSchema = ftpMeasurementInputSchema.extend({
  id: z.uuid(),
});

export const availabilityInputSchema = z.strictObject({
  timezone: z.string().min(1).max(64),
  weekdays: z
    .array(
      z.strictObject({
        weekday: z.number().int().min(0).max(6),
        availableMinutes: z.number().int().min(15).max(720),
      }),
    )
    .min(1)
    .max(7),
  maxSessionMinutes: z.number().int().min(15).max(720),
  expectedVersion: z.number().int().positive().optional(),
});
export const availabilityResponseSchema = availabilityInputSchema
  .omit({ expectedVersion: true })
  .extend({
    version: z.number().int().positive(),
  });

export const goalInputSchema = z.strictObject({
  type: z.enum(["FTP", "ENDURANCE", "CLIMBING", "RACE"]),
  description: z.string().trim().max(200).nullable().optional(),
  targetWkg: z.number().min(1).max(10).nullable().optional(),
  targetDate: z.iso.date(),
  priority: z.enum(["PRIMARY", "SECONDARY"]),
});
export const goalSchema = goalInputSchema.extend({
  id: z.uuid(),
  status: z.enum(["ACTIVE", "PAUSED", "CLOSED"]),
  version: z.number().int().positive(),
});
export const goalPatchSchema = goalInputSchema
  .partial()
  .extend({
    status: z.enum(["ACTIVE", "PAUSED", "CLOSED"]).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const activityInputSchema = z.strictObject({
  workoutId: z.uuid(),
  localDate: z.iso.date(),
  status: z.enum(["COMPLETED", "PARTIAL", "SKIPPED"]),
  durationMin: z.number().int().min(0).max(1440).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  fatigue: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().trim().max(200).nullable().optional(),
});
export const assessmentInputSchema = z.strictObject({
  goalId: z.uuid().nullable().optional(),
  localDate: z.iso.date(),
  protocol: z.string().trim().min(1).max(64),
});
export const assessmentPatchSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  status: z.enum(["COMPLETED", "POSTPONED", "SKIPPED", "INVALID"]),
  localDate: z.iso.date().optional(),
  resultWatts: z.number().int().min(50).max(800).nullable().optional(),
  conditions: z.string().trim().max(200).nullable().optional(),
});
export const raceInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  localDate: z.iso.date(),
  timezone: z.string().min(1).max(64),
  distanceKm: z.number().positive().max(2000),
  priority: z.enum(["A", "B", "C"]),
});
export const racePatchSchema = raceInputSchema
  .partial()
  .extend({
    expectedVersion: z.number().int().positive(),
    status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
  })
  .strict();

export const readinessSchema = z.object({
  ready: z.boolean(),
  missingFields: z.array(
    z.enum(["ftp", "goal", "availability", "experienceLevel", "weightKg"]),
  ),
  activePlanVersion: z.number().int().nonnegative(),
});

export const weekGenerationInputSchema = z.strictObject({
  weekStartDate: z.iso.date(),
  goalId: z.uuid(),
  mode: z.enum(["initial", "empty_week", "replace_week", "replace_workout"]),
  expectedBaseVersion: z.number().int().nonnegative(),
  reason: z
    .enum([
      "TIME_SHORT",
      "FATIGUE",
      "WEATHER",
      "SCHEDULE",
      "TOO_HARD",
      "MISSED",
      "ASSESSMENT",
      "RACE",
    ])
    .optional(),
  targetWorkoutId: z.uuid().optional(),
  relatedId: z.uuid().optional(),
  notes: z.string().trim().max(200).optional(),
  symptomFlags: z
    .array(z.enum(["CHEST_PAIN", "FAINTING", "SEVERE_ILLNESS"]))
    .max(3)
    .optional(),
});
export const generationResponseSchema = z.object({
  generationId: z.uuid(),
  status: z.enum(["QUEUED", "RUNNING", "READY", "FAILED"]),
  proposalId: z.uuid().nullable(),
  errorCode: z.string().nullable(),
  requestId: z.string().nullable(),
});

export const aiWorkoutDraftSchema = z.strictObject({
  scheduledDate: z.iso.date(),
  title: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(64),
  segments: z.array(workoutSegmentSchema).min(1).max(50),
});
export const aiWeekOutputSchema = z.strictObject({
  summary: z.string().trim().min(1).max(1000),
  workouts: z.array(aiWorkoutDraftSchema).min(1).max(14),
  stageSummary: z.string().trim().min(1).max(1000),
  assessmentSuggestion: z.string().trim().min(1).max(500),
});
export const updateAiProposalSchema = z.strictObject({
  expectedProposalVersion: z.number().int().positive(),
  draft: aiWeekOutputSchema,
});
export const coachChatInputSchema = z.strictObject({
  message: z.string().trim().min(1).max(500),
});
export const coachChatResponseSchema = z.object({
  answer: z.string(),
  requestId: z.string(),
  model: z.string(),
  readOnly: z.literal(true),
});
export const restoreProposalInputSchema = z.strictObject({
  expectedBaseVersion: z.number().int().positive(),
});
export const restoreProposalResponseSchema = z.object({
  proposalId: z.uuid(),
  status: z.enum([
    "DRAFT",
    "READY",
    "BLOCKED",
    "APPLIED",
    "REJECTED",
    "EXPIRED",
  ]),
  basePlanVersion: z.number().int().positive(),
  targetPlanVersion: z.number().int().positive(),
  affectedDates: z.array(z.iso.date()),
  beforeCount: z.number().int().nonnegative(),
  afterCount: z.number().int().nonnegative(),
  blockers: z.array(z.string()),
});
export const aiProposalResponseSchema = z.object({
  proposalId: z.uuid(),
  status: z.enum([
    "DRAFT",
    "READY",
    "BLOCKED",
    "APPLIED",
    "REJECTED",
    "EXPIRED",
  ]),
  proposalVersion: z.number().int().positive(),
  basePlanVersion: z.number().int().nonnegative(),
  scene: z.enum([
    "WEEK_PLAN",
    "WORKOUT_ADJUST",
    "PLAN_ADJUST",
    "ASSESSMENT_REVIEW",
    "RACE_REPLAN",
  ]),
  replaceWorkoutIds: z.array(z.uuid()),
  weekStartDate: z.iso.date(),
  summary: z.string(),
  stageSummary: z.string(),
  assessmentSuggestion: z.string(),
  workouts: z.array(aiWorkoutDraftSchema),
  warnings: z.array(z.string()),
  blockers: z.array(z.string()),
  skillVersion: z.string(),
  model: z.string(),
});

export type FtpMeasurementInput = z.infer<typeof ftpMeasurementInputSchema>;
export type AvailabilityInput = z.infer<typeof availabilityInputSchema>;
export type GoalInput = z.infer<typeof goalInputSchema>;
export type GoalPatch = z.infer<typeof goalPatchSchema>;
export type ActivityInput = z.infer<typeof activityInputSchema>;
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type AssessmentPatch = z.infer<typeof assessmentPatchSchema>;
export type RaceInput = z.infer<typeof raceInputSchema>;
export type RacePatch = z.infer<typeof racePatchSchema>;
export type WeekGenerationInput = z.infer<typeof weekGenerationInputSchema>;
export type AiWeekOutput = z.infer<typeof aiWeekOutputSchema>;
export type AiWorkoutDraft = z.infer<typeof aiWorkoutDraftSchema>;
export type UpdateAiProposal = z.infer<typeof updateAiProposalSchema>;
export type CoachChatInput = z.infer<typeof coachChatInputSchema>;
export type RestoreProposalResponse = z.infer<
  typeof restoreProposalResponseSchema
>;
export type AiProposalResponse = z.infer<typeof aiProposalResponseSchema>;
