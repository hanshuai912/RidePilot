import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        credentials: { where: { identifierType: "PHONE" } },
        athleteProfile: true,
      },
    });
  }

  async patch(
    userId: string,
    expectedVersion: number | undefined,
    data: {
      displayName?: string | null;
      profileVersion: number;
      athlete: Record<string, unknown>;
    },
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: userId,
          ...(expectedVersion === undefined
            ? {}
            : { profileVersion: expectedVersion }),
        },
        data: {
          ...(data.displayName === undefined
            ? {}
            : { displayName: data.displayName }),
          profileVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) return false;

      await tx.athleteProfile.upsert({
        where: { userId },
        create: { userId, ...data.athlete },
        update: data.athlete,
      });
      return true;
    });
  }
}
