import { z } from "zod";

export const stageDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  purpose: z.string().trim().min(1).max(300),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  assessmentSuggestion: z.string().trim().min(1).max(300),
});

export const courseStagePlanSchema = z.strictObject({
  action: z.enum(["CREATE", "REPLACE", "EXTEND", "REUSE"]),
  summary: z.string().trim().min(1).max(1000),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  stages: z.array(stageDraftSchema).min(1).max(12),
});

export type CourseStagePlan = z.infer<typeof courseStagePlanSchema>;
