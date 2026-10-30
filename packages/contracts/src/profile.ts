import { z } from "zod";

export const genderSchema = z.enum([
  "MALE",
  "FEMALE",
  "OTHER",
  "PREFER_NOT_TO_SAY",
]);
export const experienceLevelSchema = z.enum([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
]);

export const profileResponseSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  phoneMasked: z.string(),
  phoneVerificationStatus: z.enum(["UNVERIFIED", "VERIFIED"]),
  gender: genderSchema.nullable(),
  birthDate: z.iso.date().nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  experienceLevel: experienceLevelSchema.nullable(),
  // Timezone is retained as read-only context for date-sensitive training flows.
  timezone: z.string().max(64),
  locale: z.string().max(16),
  version: z.number().int().positive(),
});

export const profilePatchSchema = z
  .object({
    displayName: z.string().trim().max(80).nullable().optional(),
    gender: genderSchema.nullable().optional(),
    birthDate: z.iso.date().nullable().optional(),
    heightCm: z.number().min(50).max(250).nullable().optional(),
    weightKg: z.number().min(20).max(400).nullable().optional(),
    experienceLevel: experienceLevelSchema.nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
