import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  services: z.object({
    database: z.literal("ok"),
    redis: z.literal("ok"),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
