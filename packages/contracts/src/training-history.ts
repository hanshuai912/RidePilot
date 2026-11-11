import { z } from "zod";
import { workoutSummarySchema } from "./training";

export const trainingHistoryCursorSchema = z.strictObject({
  date: z.iso.date(),
  dayOrder: z.number().int().positive(),
  id: z.uuid(),
});
export const trainingHistoryQuerySchema = z.strictObject({
  cursor: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});
export const trainingHistoryResponseSchema = z.object({
  timezone: z.string(),
  localDate: z.iso.date(),
  items: z.array(workoutSummarySchema),
  nextCursor: z.string().nullable(),
});
export type TrainingHistoryCursor = z.infer<typeof trainingHistoryCursorSchema>;
export type TrainingHistoryResponse = z.infer<
  typeof trainingHistoryResponseSchema
>;
