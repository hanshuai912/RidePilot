import { Injectable } from "@nestjs/common";
import type { TrainingHistoryCursor } from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";
import { dateToDb } from "./training.validation";

@Injectable()
export class TrainingHistoryRepository {
  async page(
    db: Prisma.TransactionClient,
    userId: string,
    today: string,
    cursor: TrainingHistoryCursor | null,
    take: number,
  ) {
    const cursorDate = cursor ? dateToDb(cursor.date) : null;
    const cursorOrder = cursor?.dayOrder ?? 0;
    const cursorId = cursor?.id ?? "00000000-0000-0000-0000-000000000000";
    // Current courses plus recorded immutable originals; prefer the current
    // copy of an unchanged course so version publication never duplicates it.
    const rows = await db.$queryRaw<{ id: string }[]>`
      WITH candidates AS (
        SELECT w.id, w.scheduled_date, w.day_order,
          COALESCE(w.structure->>'activityWorkoutId', w.id::text) AS identity,
          COALESCE(p.active_version_id = v.id AND p.status = 'ACTIVE', false) AS is_current
        FROM workouts w
        JOIN plan_versions v ON v.id = w.plan_version_id
        JOIN training_plans p ON p.id = v.plan_id
        WHERE p.user_id = ${userId}::uuid
          AND v.applied_at IS NOT NULL
          AND w.scheduled_date <= ${dateToDb(today)}::date
          AND (
            (p.active_version_id = v.id AND p.status = 'ACTIVE')
            OR EXISTS (
              SELECT 1 FROM training_activities a
              WHERE a.user_id = p.user_id AND a.workout_id = w.id
            )
          )
      ), canonical AS (
        SELECT DISTINCT ON (identity) * FROM candidates
        ORDER BY identity, is_current DESC, id ASC
      )
      SELECT id FROM canonical
      WHERE ${cursorDate}::date IS NULL
        OR scheduled_date < ${cursorDate}::date
        OR (scheduled_date = ${cursorDate}::date AND day_order > ${cursorOrder})
        OR (scheduled_date = ${cursorDate}::date AND day_order = ${cursorOrder}
          AND id > ${cursorId}::uuid)
      ORDER BY scheduled_date DESC, day_order ASC, id ASC
      LIMIT ${take}
    `;
    const workouts = await db.workout.findMany({
      where: {
        id: { in: rows.map((r) => r.id) },
        planVersion: { plan: { userId } },
      },
      include: { planVersion: { select: { versionNo: true } } },
    });
    const byId = new Map(workouts.map((w) => [w.id, w]));
    return rows.flatMap((r) => {
      const workout = byId.get(r.id);
      return workout ? [workout] : [];
    });
  }

  async detail(
    db: Prisma.TransactionClient,
    userId: string,
    workoutId: string,
    today: string,
  ) {
    const recorded = await db.trainingActivity.findFirst({
      where: { userId, workoutId },
      select: { id: true },
    });
    return db.workout.findFirst({
      where: {
        id: workoutId,
        scheduledDate: { lte: dateToDb(today) },
        planVersion: {
          plan: { userId },
          appliedAt: { not: null },
          ...(recorded ? {} : { activeForPlan: { userId, status: "ACTIVE" } }),
        },
      },
      include: { planVersion: { select: { versionNo: true } } },
    });
  }
}
