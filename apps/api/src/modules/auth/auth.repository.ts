import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string) {
    return this.prisma.authCredential.findUnique({
      where: {
        identifierType_loginIdentifier: {
          identifierType: "PHONE",
          loginIdentifier: phone,
        },
      },
      include: { user: true },
    });
  }

  findPhoneByUserId(userId: string) {
    return this.prisma.authCredential.findFirst({
      where: { userId, identifierType: "PHONE" },
    });
  }

  findSession(sessionId: string) {
    return this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
  }

  async createAccount(input: {
    userId: string;
    sessionId: string;
    phone: string;
    passwordHash: string;
    refreshTokenHash: string;
    sessionExpiresAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: input.userId,
          credentials: {
            create: {
              loginIdentifier: input.phone,
              identifierType: "PHONE",
              verificationStatus: "UNVERIFIED",
              passwordHash: input.passwordHash,
            },
          },
        },
      });
      await tx.authSession.create({
        data: {
          id: input.sessionId,
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.sessionExpiresAt,
        },
      });
    });
  }

  async createSession(input: {
    userId: string;
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.authSession.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  async rotateSession(input: {
    userId: string;
    sessionId: string;
    oldTokenHash: string;
    newTokenHash: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const result = await this.prisma.authSession.updateMany({
      where: {
        id: input.sessionId,
        userId: input.userId,
        refreshTokenHash: input.oldTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: input.newTokenHash,
        expiresAt: input.expiresAt,
        version: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
