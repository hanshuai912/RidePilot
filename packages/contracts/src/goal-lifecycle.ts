import { z } from "zod";
import { goalInputSchema, goalSchema } from "./coach";

export const goalActionSchema = z.enum([
  "UPDATE",
  "PAUSE",
  "RESUME",
  "COMPLETE",
  "CLOSE",
  "CREATE_NEXT",
]);
export const goalChangeSchema = z.strictObject({
  action: goalActionSchema,
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(300),
  changes: goalInputSchema.partial().optional(),
  nextGoal: goalInputSchema.optional(),
});
export const goalEvaluationSchema = z.object({
  localDate: z.iso.date(),
  daysRemaining: z.number().int(),
  weeklyMinutes: z.number().nullable(),
  currentFtp: z
    .object({
      valueWatts: z.number(),
      measuredAt: z.iso.datetime(),
      source: z.string(),
    })
    .nullable(),
  wattsGap: z.number().nullable(),
  wkgGap: z.number().nullable(),
  notices: z.array(z.string()),
});
export const goalCreationPreviewSchema = z.object({
  evaluation: goalEvaluationSchema,
  warnings: z.array(z.string()),
});
export const goalChangePreviewSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  before: goalSchema,
  after: goalSchema,
  nextGoal: goalInputSchema.nullable(),
  affected: z.object({
    workouts: z.array(
      z.object({ id: z.uuid(), date: z.iso.date(), title: z.string() }),
    ),
    assessments: z.array(
      z.object({ id: z.uuid(), date: z.iso.date(), title: z.string() }),
    ),
    stages: z.array(z.object({ id: z.uuid(), title: z.string() })),
    otherPrimaryGoals: z.array(goalSchema),
  }),
  evaluation: goalEvaluationSchema,
  warnings: z.array(z.string()),
});
export const applyGoalChangeSchema = z.strictObject({
  change: goalChangeSchema,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export const goalChangeResultSchema = z.object({
  mutationId: z.uuid(),
  goal: goalSchema,
  nextGoal: goalSchema.nullable(),
});
export const goalOverviewSchema = z.object({
  goal: goalSchema,
  evaluation: goalEvaluationSchema,
  history: z.array(
    z.object({
      id: z.uuid(),
      action: z.string(),
      reason: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export type GoalChange = z.infer<typeof goalChangeSchema>;
export type GoalChangePreview = z.infer<typeof goalChangePreviewSchema>;
export type GoalEvaluation = z.infer<typeof goalEvaluationSchema>;
export type GoalOverview = z.infer<typeof goalOverviewSchema>;
