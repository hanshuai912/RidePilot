import { z } from "zod";
import { activePlanStatusSchema } from "./coach";
import { nutritionPlanResponseSchema } from "./nutrition";
import { profileResponseSchema } from "./profile";
import { calendarResponseSchema, workoutSummarySchema } from "./training";

const homeSection = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("READY"), data }),
    z.object({
      status: z.literal("UNAVAILABLE"),
      error: z.object({ code: z.string(), message: z.string() }),
    }),
  ]);

export const homeTrainingSchema = z.object({
  plan: activePlanStatusSchema,
  calendar: calendarResponseSchema,
  nextWorkout: workoutSummarySchema.nullable(),
});
export const homeTodayResponseSchema = z.object({
  localDate: z.iso.date(),
  profile: profileResponseSchema.pick({
    userId: true,
    displayName: true,
    timezone: true,
  }),
  training: homeSection(homeTrainingSchema),
  nutrition: homeSection(nutritionPlanResponseSchema),
});
export type HomeTodayResponse = z.infer<typeof homeTodayResponseSchema>;
export type HomeTraining = z.infer<typeof homeTrainingSchema>;
