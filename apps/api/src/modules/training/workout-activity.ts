import type { Prisma, TrainingActivity } from "../../generated/prisma/client";
import type { PrismaService } from "../../infra/prisma/prisma.service";

type WorkoutIdentity = { id: string; structure: unknown };

// Immutable plan versions copy workouts. Keep the identity of the unchanged
// workout's actual record, rather than copying or moving the actual record.
export function activityWorkoutId(workout: WorkoutIdentity): string {
  const structure = workout.structure as { activityWorkoutId?: string };
  return structure.activityWorkoutId ?? workout.id;
}

export function copiedWorkoutStructure(
  workout: WorkoutIdentity,
): Prisma.InputJsonObject {
  return {
    ...(workout.structure as Prisma.InputJsonObject),
    activityWorkoutId: activityWorkoutId(workout),
  };
}

export async function workoutActivities(
  db: PrismaService | Prisma.TransactionClient,
  userId: string,
  workouts: WorkoutIdentity[],
) {
  if (!workouts.length) return new Map<string, TrainingActivity>();
  const records = await db.trainingActivity.findMany({
    where: { userId, workoutId: { in: workouts.map(activityWorkoutId) } },
  });
  const byIdentity = new Map(
    records.map((record) => [record.workoutId, record]),
  );
  return new Map(
    workouts.flatMap((workout) => {
      const record = byIdentity.get(activityWorkoutId(workout));
      return record ? [[workout.id, record] as const] : [];
    }),
  );
}
