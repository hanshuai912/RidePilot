export const COROS_CAPABILITIES = [
  "activities.read",
  "activity.detail.read",
  "sleep.read",
  "recovery.read",
] as const;

export type ProviderKey = "coros";

export type ProviderDefinition = {
  key: ProviderKey;
  displayName: string;
  capabilities: readonly string[];
  configured: boolean;
};
