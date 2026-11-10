import type { Workout } from "../../generated/prisma/client";
import { workoutSegments } from "../training/calendar-events";
import { dbToDate } from "../training/training.validation";

// Include the days bordering a replacement range: recovery cannot reset at
// the boundary between an existing plan and a newly generated proposal.
export function retainedHardDates(
  workouts: Workout[],
  replacing: string[],
  ftp: number,
  start: string,
  end: string,
) {
  const first = Date.parse(start) - 86400000;
  const last = Date.parse(end) + 86400000;
  return workouts
    .filter(
      (workout) =>
        !replacing.includes(workout.id) &&
        workout.scheduledDate.getTime() >= first &&
        workout.scheduledDate.getTime() <= last &&
        workoutSegments(workout.structure).some(
          (segment) =>
            segment.type === "work" &&
            (segment.intensity.kind === "ftp_percent"
              ? segment.intensity.max / 100
              : segment.intensity.max / ftp) >= 0.9,
        ),
    )
    .map((workout) => dbToDate(workout.scheduledDate));
}
