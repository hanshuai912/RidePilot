import { availabilityResponseSchema } from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";

// Persistence rows contain IDs and timestamps that the strict public schema
// intentionally rejects. Select the public fields before validating.
export function parseTrainingAvailability(
  row: {
    timezone: string;
    weekdays: Prisma.JsonValue;
    maxSessionMinutes: number;
    version: number;
  } | null,
) {
  return availabilityResponseSchema.safeParse(
    row
      ? {
          timezone: row.timezone,
          weekdays: row.weekdays,
          maxSessionMinutes: row.maxSessionMinutes,
          version: row.version,
        }
      : null,
  );
}
