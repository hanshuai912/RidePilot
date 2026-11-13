import type { WorkoutSegment } from "@ridepilot/contracts";

export const segmentTypeLabels = {
  warmup: "热身",
  work: "训练",
  recovery: "恢复",
  cooldown: "放松",
} as const;

export type ProfileMaximums = Partial<
  Record<WorkoutSegment["intensity"]["kind"], number>
>;

export function buildWorkoutProfile(
  segments: WorkoutSegment[],
  maximums: ProfileMaximums = {},
) {
  const timed = segments.filter(
    (segment) => segment.target.kind === "duration",
  );
  if (
    !timed.length ||
    timed.some(
      ({ target, intensity, repeatCount = 1 }) =>
        !Number.isFinite(target.value) ||
        target.value <= 0 ||
        !Number.isInteger(repeatCount) ||
        repeatCount <= 0 ||
        !Number.isFinite(intensity.min) ||
        !Number.isFinite(intensity.max) ||
        intensity.min <= 0 ||
        intensity.max < intensity.min,
    )
  )
    return null;

  const totalMinutes = timed.reduce(
    (sum, segment) => sum + segment.target.value * (segment.repeatCount ?? 1),
    0,
  );
  if (!Number.isFinite(totalMinutes)) return null;

  const kinds = [...new Set(timed.map((segment) => segment.intensity.kind))];
  const lanes = kinds.map((kind) => ({
    kind,
    unit: kind === "power_watt" ? "W" : "%FTP",
    // Independent scales keep watts and FTP percentages from being compared.
    maximum:
      Math.ceil(
        (Math.max(
          ...timed
            .filter((segment) => segment.intensity.kind === kind)
            .map(
              (segment) => (segment.intensity.min + segment.intensity.max) / 2,
            ),
        ) *
          1.2) /
          10,
      ) * 10,
  }));
  for (const lane of lanes) {
    const sharedMaximum = maximums[lane.kind];
    if (sharedMaximum && Number.isFinite(sharedMaximum))
      lane.maximum = Math.max(lane.maximum, sharedMaximum);
  }

  let elapsed = 0;
  const blocks = timed.map((segment) => {
    const minutes = segment.target.value * (segment.repeatCount ?? 1);
    const block = {
      type: segment.type,
      kind: segment.intensity.kind,
      minutes,
      averageIntensity: (segment.intensity.min + segment.intensity.max) / 2,
      start: elapsed / totalMinutes,
      width: minutes / totalMinutes,
    };
    elapsed += minutes;
    return block;
  });

  const legend = [...new Set(blocks.map((block) => block.type))].map(
    (type) => ({
      type,
      minutes: blocks
        .filter((block) => block.type === type)
        .reduce((sum, block) => sum + block.minutes, 0),
    }),
  );

  return { blocks, lanes, legend, totalMinutes };
}

/** Before/after charts use the same scale for each intensity unit. */
export function comparisonMaximums(
  ...workouts: WorkoutSegment[][]
): ProfileMaximums {
  const maximums: ProfileMaximums = {};
  for (const segments of workouts) {
    for (const lane of buildWorkoutProfile(segments)?.lanes ?? [])
      maximums[lane.kind] = Math.max(maximums[lane.kind] ?? 0, lane.maximum);
  }
  return maximums;
}

export function formatProfileNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}
