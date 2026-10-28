import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class TrainingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActivePlan(userId: string) {
    return this.prisma.trainingPlan.findFirst({
      where: { userId, status: "ACTIVE", activeVersionId: { not: null } },
      include: {
        activeVersion: { include: { workouts: true } },
      },
    });
  }

  findWorkout(userId: string, workoutId: string) {
    return this.prisma.workout.findFirst({
      where: {
        id: workoutId,
        planVersion: {
          activeForPlan: { userId, status: "ACTIVE" },
        },
      },
      include: { planVersion: { include: { plan: true } } },
    });
  }

  findProposal(userId: string, proposalId: string) {
    return this.prisma.changeProposal.findFirst({
      where: { id: proposalId, userId },
      include: { baseVersion: { include: { plan: true } } },
    });
  }

  findCalendar(userId: string, from: Date, to: Date) {
    return this.prisma.workout.findMany({
      where: {
        planVersion: {
          activeForPlan: { userId, status: "ACTIVE" },
        },
        scheduledDate: { gte: from, lte: to },
      },
      include: { planVersion: { select: { versionNo: true } } },
      orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
    });
  }

  findRecordedWorkoutIds(userId: string, workoutIds: string[]) {
    if (workoutIds.length === 0) return Promise.resolve([] as string[]);
    return this.prisma.trainingActivity
      .findMany({
        where: {
          userId,
          workoutId: { in: workoutIds },
        },
        select: { workoutId: true },
      })
      .then((activities) =>
        activities.flatMap((activity) =>
          activity.workoutId ? [activity.workoutId] : [],
        ),
      );
  }
}
