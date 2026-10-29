import { z } from "zod";

export const integrationProviderSchema = z.object({
  key: z.string().min(1),
  displayName: z.string().min(1),
  status: z.enum(["AVAILABLE", "CONFIGURATION_REQUIRED"]),
  capabilities: z.array(z.string()),
});

export const integrationProviderListSchema = z.array(integrationProviderSchema);

export const externalConnectionSchema = z.object({
  id: z.uuid(),
  providerKey: z.string().min(1),
  displayName: z.string().min(1),
  status: z.enum([
    "AUTHORIZING",
    "CONNECTED",
    "REAUTH_REQUIRED",
    "DEGRADED",
    "FAILED",
  ]),
  providerAccountLabel: z.string().nullable(),
  capabilities: z.array(z.string()),
  lastSyncedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});

export const externalConnectionListSchema = z.array(externalConnectionSchema);

export const integrationAuthorizationResponseSchema = z.object({
  providerKey: z.string().min(1),
  authorizationAttemptId: z.uuid(),
  authorizationUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});

export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type ExternalConnection = z.infer<typeof externalConnectionSchema>;
export type IntegrationAuthorizationResponse = z.infer<
  typeof integrationAuthorizationResponseSchema
>;
