import { z } from "zod";

export const workoutSegmentTypeSchema = z.enum([
  "warmup",
  "work",
  "recovery",
  "cooldown",
]);
export const workoutTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("duration"),
    value: z.number().positive(),
    unit: z.literal("min"),
  }),
  z.object({
    kind: z.literal("distance"),
    value: z.number().positive(),
    unit: z.literal("km"),
  }),
]);
export const workoutIntensitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ftp_percent"),
    min: z.number().min(1).max(200),
    max: z.number().min(1).max(200),
  }),
  z.object({
    kind: z.literal("power_watt"),
    min: z.number().min(1).max(2000),
    max: z.number().min(1).max(2000),
  }),
]);
export const workoutSegmentSchema = z.object({
  id: z.string().uuid().optional(),
  type: workoutSegmentTypeSchema,
  target: workoutTargetSchema,
  intensity: workoutIntensitySchema,
  repeatCount: z.number().int().positive().max(100).optional(),
});

export const manualWorkoutDraftSchema = z.object({
  scheduledDate: z.string().date(),
  title: z.string().trim().max(120).nullable().optional(),
  purpose: z.string().trim().max(64).nullable().optional(),
  segments: z.array(workoutSegmentSchema),
});

export const createManualWorkoutProposalSchema = manualWorkoutDraftSchema;
export const editWorkoutProposalSchema = manualWorkoutDraftSchema.extend({
  expectedPlanVersion: z.number().int().positive(),
});
export const updateProposalSchema = z.object({
  expectedProposalVersion: z.number().int().positive(),
  draft: manualWorkoutDraftSchema,
});
export const applyProposalSchema = z.object({
  expectedBaseVersion: z.number().int().nonnegative(),
  expectedProposalVersion: z.number().int().positive().optional(),
});

export const workoutActivitySchema = z.object({
  id: z.uuid(),
  status: z.enum(["COMPLETED", "PARTIAL", "SKIPPED"]),
  durationMin: z.number().nullable(),
  rpe: z.number().nullable(),
  fatigue: z.number().nullable(),
  notes: z.string().nullable(),
});

export const workoutSummarySchema = z.object({
  ftpSnapshotWatts: z.number().positive().nullable().optional(),
  id: z.uuid(),
  planVersion: z.number().int().positive(),
  sportType: z.literal("cycling"),
  source: z.enum(["manual", "ai"]),
  title: z.string().nullable(),
  purpose: z.string().nullable(),
  scheduledDate: z.string().date(),
  dayOrder: z.number().int().positive(),
  timeTargetMinutes: z.number().nonnegative().nullable(),
  distanceTargetKm: z.number().nonnegative().nullable(),
  segments: z.array(workoutSegmentSchema),
  /** Whether this workout can still be changed by a plan adjustment. */
  editable: z.boolean().optional(),
  activity: workoutActivitySchema.nullable().optional(),
});

export const nextWorkoutResponseSchema = z.object({
  workout: workoutSummarySchema.nullable(),
});

export const proposalResponseSchema = z.object({
  proposalId: z.uuid(),
  proposalType: z.enum(["MANUAL_WORKOUT_CREATE", "MANUAL_WORKOUT_EDIT"]),
  status: z.enum([
    "DRAFT",
    "PENDING_VALIDATION",
    "READY",
    "BLOCKED",
    "APPLIED",
    "REJECTED",
    "EXPIRED",
  ]),
  basePlanVersion: z.number().int().nonnegative(),
  proposalVersion: z.number().int().positive(),
  originalWorkout: workoutSummarySchema.nullable(),
  draftWorkout: workoutSummarySchema,
  validation: z.object({
    passed: z.boolean().nullable(),
    warnings: z.array(z.string()),
    blockers: z.array(z.string()),
  }),
});

export const applyProposalResponseSchema = z.object({
  success: z.literal(true),
  newPlanVersion: z.number().int().positive(),
  affectedDates: z.array(z.string().date()),
});

export const calendarEventSchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  kind: z.enum(["REST", "RECOVERY"]),
  title: z.string(),
  source: z.enum(["AVAILABILITY", "WORKOUT"]),
});
export const rescheduleInputSchema = z.strictObject({
  scheduledDate: z.iso.date(),
  expectedPlanVersion: z.number().int().positive(),
});
export const reschedulePreviewSchema = z.object({
  workoutId: z.uuid(),
  planVersion: z.number().int().positive(),
  from: z.iso.date(),
  to: z.iso.date(),
  conflicts: z.array(z.string()),
  alternatives: z.array(
    z.object({ date: z.iso.date(), availableMinutes: z.number().positive() }),
  ),
});
export type RescheduleInput = z.infer<typeof rescheduleInputSchema>;
export type ReschedulePreview = z.infer<typeof reschedulePreviewSchema>;

export const calendarResponseSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  ftpAvailable: z.boolean(),
  timezone: z.string().optional(),
  localDate: z.iso.date().optional(),
  events: z.array(calendarEventSchema).optional(),
  items: z.array(workoutSummarySchema),
});

export type WorkoutSegment = z.infer<typeof workoutSegmentSchema>;
export type ManualWorkoutDraft = z.infer<typeof manualWorkoutDraftSchema>;
export type CreateManualWorkoutProposal = z.infer<
  typeof createManualWorkoutProposalSchema
>;
export type EditWorkoutProposal = z.infer<typeof editWorkoutProposalSchema>;
export type UpdateProposal = z.infer<typeof updateProposalSchema>;
export type ApplyProposal = z.infer<typeof applyProposalSchema>;
export type ProposalResponse = z.infer<typeof proposalResponseSchema>;
export type ApplyProposalResponse = z.infer<typeof applyProposalResponseSchema>;
export type CalendarResponse = z.infer<typeof calendarResponseSchema>;
