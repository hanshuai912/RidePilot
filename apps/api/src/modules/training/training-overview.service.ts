import { Injectable } from "@nestjs/common";
import { homeTrainingSchema, type HomeTraining } from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { workoutActivities } from "./workout-activity";
import { toSummary } from "./training.mapper";
import { dateToDb } from "./training.validation";

@Injectable()
export class TrainingOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async today(userId: string, localDate: string): Promise<HomeTraining> {
    // Read one immutable active snapshot for plan status, today's courses and
    // the next course, so a concurrent publication cannot mix plan versions.
    return this.prisma.$transaction(
      async (tx) => {
        const plan = await tx.trainingPlan.findFirst({
          where: { userId, status: "ACTIVE", activeVersionId: { not: null } },
          include: {
            activeVersion: {
              include: {
                workouts: {
                  where: { scheduledDate: { gte: dateToDb(localDate) } },
                  orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
                },
              },
            },
          },
        });
        const ftp = await tx.abilityMeasurement.findFirst({
          where: { userId, metricType: "FTP", unit: "W" },
          orderBy: { measuredAt: "desc" },
        });
        const version = plan?.activeVersion;
        const workouts = version?.workouts ?? [];
        const activities = await workoutActivities(tx, userId, workouts);
        const summaries = workouts.map((workout) =>
          toSummary({
            ...workout,
            planVersion: { versionNo: version!.versionNo },
            editable: !activities.has(workout.id),
            activity: activities.get(workout.id) ?? null,
          }),
        );
        return homeTrainingSchema.parse({
          plan: {
            hasActivePlan: !!version,
            planVersion: version?.versionNo ?? 0,
          },
          calendar: {
            from: localDate,
            to: localDate,
            ftpAvailable: !!ftp && Number(ftp.value) > 0,
            items: summaries.filter(
              (workout) => workout.scheduledDate === localDate,
            ),
          },
          nextWorkout: summaries.find((workout) => !workout.activity) ?? null,
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
