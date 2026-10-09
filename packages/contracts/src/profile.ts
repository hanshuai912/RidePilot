import { z } from "zod";

export const genderSchema = z.enum([
  "MALE",
  "FEMALE",
  "OTHER",
  "PREFER_NOT_TO_SAY",
]);
export const viewPreferenceSchema = z.enum(["SIMPLE", "PROFESSIONAL"]);
export const experienceLevelSchema = z.enum([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
]);

const nullableString = (max: number) => z.string().max(max).nullable();

export const profileResponseSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
  phoneMasked: z.string(),
  phoneVerificationStatus: z.enum(["UNVERIFIED", "VERIFIED"]),
  gender: genderSchema.nullable(),
  ageBand: nullableString(32),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  experienceLevel: experienceLevelSchema.nullable(),
  trainingPurpose: nullableString(500),
  equipmentFlags: z.array(z.string()),
  viewPreference: viewPreferenceSchema,
  timezone: z.string().max(64),
  locale: z.string().max(16),
  version: z.number().int().positive(),
});

export const profilePatchSchema = z
  .object({
    displayName: z.string().trim().max(80).nullable().optional(),
    gender: genderSchema.nullable().optional(),
    ageBand: nullableString(32).optional(),
    heightCm: z.number().min(50).max(250).nullable().optional(),
    weightKg: z.number().min(20).max(400).nullable().optional(),
    experienceLevel: experienceLevelSchema.nullable().optional(),
    trainingPurpose: nullableString(500).optional(),
    equipmentFlags: z.array(z.string().max(64)).max(30).nullable().optional(),
    viewPreference: viewPreferenceSchema.optional(),
    timezone: z.string().min(1).max(64).optional(),
    locale: z.string().min(2).max(16).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
