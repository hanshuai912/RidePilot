import type { Prisma } from "../../generated/prisma/client";
import type { PrismaService } from "../../infra/prisma/prisma.service";

export interface TrainingInputSnapshot {
  ftp: { id: string; valueWatts: number } | null;
  availability: { version: number; timezone: string } | null;
  goals: { id: string; version: number; status: string; priority: string }[];
  profile?: {
    version: number;
    heightCm: number | null;
    weightKg: number | null;
    experienceLevel: string | null;
    heartRateVersion: number | null;
  };
}

// Editing a course does not opt in to recalculating its execution power.
export function workoutInputBasis(
  current: TrainingInputSnapshot,
  originalStructure?: unknown,
): Prisma.InputJsonObject {
  if (originalStructure !== undefined) {
    const original = originalStructure as Prisma.InputJsonObject;
    return {
      ...(original.inputSnapshot
        ? { inputSnapshot: original.inputSnapshot }
        : {}),
      ftpSnapshotWatts: original.ftpSnapshotWatts ?? null,
    };
  }
  return {
    inputSnapshot: current as unknown as Prisma.InputJsonValue,
    ftpSnapshotWatts: current.ftp?.valueWatts ?? null,
  };
}

export async function trainingInputSnapshot(
  db: Prisma.TransactionClient | PrismaService,
  userId: string,
): Promise<TrainingInputSnapshot> {
  const [ftp, availability, goals, user, profile, heartRate] =
    await Promise.all([
      db.abilityMeasurement.findFirst({
        where: { userId, metricType: "FTP", unit: "W" },
        orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
      }),
      db.trainingAvailability.findUnique({ where: { userId } }),
      db.trainingGoal.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        select: { id: true, version: true, status: true, priority: true },
      }),
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { profileVersion: true },
      }),
      db.athleteProfile.findUnique({
        where: { userId },
        select: { heightCm: true, weightKg: true, experienceLevel: true },
      }),
      db.heartRateSettings.findUnique({
        where: { userId },
        select: { version: true },
      }),
    ]);
  return {
    ftp: ftp ? { id: ftp.id, valueWatts: Number(ftp.value) } : null,
    availability: availability
      ? { version: availability.version, timezone: availability.timezone }
      : null,
    goals,
    profile: {
      version: user.profileVersion,
      heightCm: profile?.heightCm ? Number(profile.heightCm) : null,
      weightKg: profile?.weightKg ? Number(profile.weightKg) : null,
      experienceLevel: profile?.experienceLevel ?? null,
      heartRateVersion: heartRate?.version ?? null,
    },
  };
}
