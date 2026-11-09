import type { WorkoutSegment } from "@ridepilot/contracts";

export function moveSegment(
  segments: WorkoutSegment[],
  from: number,
  to: number,
) {
  if (from < 0 || to < 0 || from >= segments.length || to >= segments.length)
    return segments;
  const moved = [...segments];
  const [segment] = moved.splice(from, 1);
  moved.splice(to, 0, segment);
  return moved;
}
