import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class NutritionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfile(userId: string) {
    return this.prisma.nutritionProfile.findUnique({ where: { userId } });
  }

  createProfile(
    userId: string,
    data: Omit<Prisma.NutritionProfileCreateInput, "user">,
  ) {
    return this.prisma.nutritionProfile.create({
      data: { ...data, user: { connect: { id: userId } } },
    });
  }

  updateProfile(
    userId: string,
    expectedVersion: number,
    data: Prisma.NutritionProfileUpdateInput,
  ) {
    return this.prisma.nutritionProfile.updateMany({
      where: { userId, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
  }

  findActivePlan(userId: string) {
    return this.prisma.nutritionPlan.findFirst({
      where: { userId, status: "ACTIVE", activeVersionId: { not: null } },
      include: { activeVersion: { include: { items: true } } },
    });
  }

  findProposal(userId: string, proposalId: string) {
    return this.prisma.nutritionProposal.findFirst({
      where: { id: proposalId, userId },
      include: { baseVersion: true },
    });
  }

  findProposalByCreateKey(userId: string, key: string) {
    return this.prisma.nutritionProposal
      .findUnique({
        where: { idempotencyKey: key },
      })
      .then((proposal) => (proposal?.userId === userId ? proposal : null));
  }

  findPlanItem(userId: string, itemId: string) {
    return this.prisma.nutritionItem.findFirst({
      where: {
        id: itemId,
        planVersion: { activeForPlan: { userId, status: "ACTIVE" } },
      },
      include: { planVersion: { include: { plan: true, items: true } } },
    });
  }
}
