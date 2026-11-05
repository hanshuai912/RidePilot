import { createHash } from "node:crypto";
import { dbToDate } from "../training/training.validation";

// Workout IDs change on every training revision; compare the actual prescription.
export function trainingDateSignatures(
  from: string,
  to: string,
  workouts: {
    scheduledDate: Date;
    title: string | null;
    purpose: string | null;
    timeTargetMin: unknown;
    distanceTargetKm: unknown;
    structure: unknown;
  }[],
): Record<string, string> {
  const signatures: Record<string, string> = {};
  for (
    let day = new Date(`${from}T00:00:00Z`);
    dbToDate(day) <= to;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = dbToDate(day);
    const sessions = workouts
      .filter((item) => dbToDate(item.scheduledDate) === date)
      .map((item) => ({
        title: item.title,
        purpose: item.purpose,
        timeTargetMin:
          item.timeTargetMin == null ? null : Number(item.timeTargetMin),
        distanceTargetKm:
          item.distanceTargetKm == null ? null : Number(item.distanceTargetKm),
        structure:
          item.structure &&
          typeof item.structure === "object" &&
          !Array.isArray(item.structure)
            ? Object.fromEntries(
                Object.entries(item.structure).filter(
                  ([key]) => key !== "activityWorkoutId",
                ),
              )
            : item.structure,
      }));
    signatures[date] = createHash("sha256")
      .update(stableJson(sessions))
      .digest("hex");
  }
  return signatures;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
