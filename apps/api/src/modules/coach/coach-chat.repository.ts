import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  CoachChatTurn as Turn,
  SendCoachChat,
} from "@ridepilot/contracts";
import type { CoachChatTurn } from "../../generated/prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { env } from "../../config/env";

export function chatTurnResponse(row: CoachChatTurn): Turn {
  const expired =
    row.status === "PROCESSING" && row.leaseExpiresAt <= new Date();
  return {
    id: row.id,
    clientMessageId: row.clientMessageId,
    question: row.question,
    answer: row.answer,
    status: expired ? "FAILED" : row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    errorMessage: expired ? "回复已中断，请重试" : row.errorMessage,
  };
}

@Injectable()
export class CoachChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: string, clientMessageId: string) {
    const row = await this.prisma.coachChatTurn.findUnique({
      where: { userId_clientMessageId: { userId, clientMessageId } },
    });
    return row ? chatTurnResponse(row) : null;
  }

  async history(userId: string, before?: string) {
    const cursor = before
      ? await this.prisma.coachChatTurn.findFirst({
          where: { id: before, userId },
        })
      : null;
    if (before && !cursor) throw new NotFoundException("聊天记录不存在");
    const rows = await this.prisma.coachChatTurn.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
    });
    return {
      turns: rows.slice(0, 20).map(chatTurnResponse),
      nextCursor: rows.length > 20 ? rows[19].id : null,
    };
  }

  async claim(userId: string, input: SendCoachChat) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize this user's claims, without holding a transaction during AI I/O.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const existing = await tx.coachChatTurn.findUnique({
        where: {
          userId_clientMessageId: {
            userId,
            clientMessageId: input.clientMessageId,
          },
        },
      });
      if (existing && existing.question !== input.message)
        throw new ConflictException({
          code: "CHAT_MESSAGE_CONFLICT",
          message: "该消息已发送，请使用新的消息编号",
        });
      const now = new Date();
      if (
        existing &&
        (existing.status === "COMPLETED" ||
          (existing.status === "PROCESSING" && existing.leaseExpiresAt > now))
      )
        return { row: existing, claimed: false };
      if ((existing?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException({
          code: "CHAT_VERSION_CONFLICT",
          message: "消息状态已变化，请刷新后重试",
        });
      const active = await tx.coachChatTurn.findFirst({
        where: { userId, status: "PROCESSING", leaseExpiresAt: { gt: now } },
      });
      if (active)
        throw new ConflictException({
          code: "CHAT_REPLY_PENDING",
          message: "AI 正在回复上一条消息，请稍候",
        });
      const attempt = {
        attemptId: randomUUID(),
        leaseExpiresAt: new Date(
          now.getTime() + env.AI_TIMEOUT_MS * 2 + 60_000,
        ),
        status: "PROCESSING" as const,
        answer: null,
        errorMessage: null,
      };
      const row = existing
        ? await tx.coachChatTurn.update({
            where: { id: existing.id },
            data: { ...attempt, version: { increment: 1 } },
          })
        : await tx.coachChatTurn.create({
            data: {
              userId,
              clientMessageId: input.clientMessageId,
              question: input.message,
              ...attempt,
            },
          });
      return { row, claimed: true };
    });
  }

  async context(userId: string, turn: CoachChatTurn) {
    const rows = await this.prisma.coachChatTurn.findMany({
      where: {
        userId,
        status: "COMPLETED",
        OR: [
          { createdAt: { lt: turn.createdAt } },
          { createdAt: turn.createdAt, id: { lt: turn.id } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
    });
    return rows.reverse().flatMap((row) => [
      { role: "user" as const, content: row.question },
      { role: "assistant" as const, content: row.answer! },
    ]);
  }

  async finish(
    row: CoachChatTurn,
    result: { answer: string } | { errorMessage: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${row.userId}::uuid FOR UPDATE`;
      await tx.coachChatTurn.updateMany({
        where: {
          id: row.id,
          userId: row.userId,
          attemptId: row.attemptId,
          status: "PROCESSING",
        },
        data: {
          ...result,
          status: "answer" in result ? "COMPLETED" : "FAILED",
          version: { increment: 1 },
        },
      });
      return tx.coachChatTurn.findUniqueOrThrow({ where: { id: row.id } });
    });
  }
}
