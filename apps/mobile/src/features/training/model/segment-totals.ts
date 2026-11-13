import type { WorkoutSegment } from "@ridepilot/contracts";

export function segmentTotals(segments: WorkoutSegment[]) {
  return segments.reduce(
    (totals, segment) => {
      const value = segment.target.value * (segment.repeatCount ?? 1);
      if (segment.target.kind === "duration") totals.minutes += value;
      else totals.kilometers += value;
      return totals;
    },
    { minutes: 0, kilometers: 0 },
  );
}
