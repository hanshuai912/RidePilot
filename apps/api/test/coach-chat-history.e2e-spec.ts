import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { AiService } from "../src/ai/ai.service";
import { AiException } from "../src/ai/exceptions/ai.exception";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { AiGenerationService } from "../src/modules/coach/ai-generation.service";
import { NutritionGenerationService } from "../src/modules/nutrition/nutrition-generation.service";
import { CoachChatRepository } from "../src/modules/coach/coach-chat.repository";
import {
  coachChatHistorySchema,
  coachChatTurnSchema,
} from "@ridepilot/contracts";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
describeDb("persistent coach chat", () => {
  jest.setTimeout(30_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: CoachChatRepository;
  let token: string;
  let userId: string;
  const users: string[] = [];
  const model = { generate: jest.fn() };
  const get = (suffix = "", access = token) =>
    request(app.getHttpServer())
      .get(`/api/v1/ai-coach/chat/messages${suffix}`)
      .set("Authorization", `Bearer ${access}`);
  const send = (body: object, access = token) =>
    request(app.getHttpServer())
      .post("/api/v1/ai-coach/chat/messages")
      .set("Authorization", `Bearer ${access}`)
      .send(body);
  const register = async () => {
    const auth = (
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          phone: `19${randomInt(100000000, 1000000000)}`,
          verificationCode: "123456",
          password: "Ab!123",
          confirmPassword: "Ab!123",
        })
        .expect(201)
    ).body;
    users.push(auth.user.id);
    return auth;
  };
  const seedPlan = async () => {
    const plan = await prisma.trainingPlan.create({
      data: { userId, status: "ACTIVE" },
    });
    const version = await prisma.planVersion.create({
      data: { planId: plan.id, versionNo: 1, appliedAt: new Date() },
    });
    await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { activeVersionId: version.id },
    });
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue(model)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    app.get(AiGenerationService).onModuleDestroy();
    app.get(NutritionGenerationService).onModuleDestroy();
    prisma = app.get(PrismaService);
    repository = app.get(CoachChatRepository);
  });
  beforeEach(async () => {
    const auth = await register();
    userId = auth.user.id;
    token = auth.tokens.accessToken;
    model.generate.mockReset().mockResolvedValue({
      text: "根据当前计划，先做好恢复。",
      requestId: randomUUID(),
      model: "test",
    });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });

  it("authenticates reads and writes, validates inputs and returns honest empty history", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/ai-coach/chat/messages")
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/ai-coach/chat/messages/unknown-key")
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/ai-coach/chat/messages")
      .send({})
      .expect(401);
    expect((await get().expect(200)).body).toEqual({
      turns: [],
      nextCursor: null,
    });
    await get("?before=invalid").expect(400);
    await send({ clientMessageId: "x", message: "问题" }).expect(400);
    await send({ clientMessageId: "valid-key", message: " " }).expect(400);
    await send({
      clientMessageId: "valid-key",
      message: "字".repeat(501),
    }).expect(400);
    await send({
      clientMessageId: "valid-key",
      message: "问题",
      history: [],
    }).expect(400);
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("persists both sides, replays duplicate sends and isolates accounts and cursors", async () => {
    await seedPlan();
    const input = {
      clientMessageId: "message-key-001",
      message: "为什么今天练耐力？",
    };
    const first = coachChatTurnSchema.parse(
      (await send(input).expect(201)).body,
    );
    expect(first).toMatchObject({
      question: input.message,
      status: "COMPLETED",
      version: 2,
      answer: "根据当前计划，先做好恢复。",
    });
    expect(
      coachChatHistorySchema.parse((await get().expect(200)).body).turns,
    ).toEqual([first]);
    expect((await send(input).expect(201)).body).toEqual(first);
    expect(model.generate).toHaveBeenCalledTimes(1);
    const other = await register();
    expect(
      (await get("", other.tokens.accessToken).expect(200)).body.turns,
    ).toEqual([]);
    expect(
      (
        await get(`/${input.clientMessageId}`, other.tokens.accessToken).expect(
          200,
        )
      ).body.turn,
    ).toBeNull();
    await get(`?before=${first.id}`, other.tokens.accessToken).expect(404);
    await send({ ...input, message: "替换已经发送的问题" }).expect(409);
    expect(await prisma.changeProposal.count({ where: { userId } })).toBe(0);
    expect(await prisma.aiGeneration.count({ where: { userId } })).toBe(0);
  });

  it("paginates tied timestamps without gaps and only sends three earlier completed turns as AI context", async () => {
    await seedPlan();
    const createdAt = new Date("2026-01-01T00:00:00Z");
    await prisma.coachChatTurn.createMany({
      data: Array.from({ length: 45 }, (_, i) => ({
        userId,
        clientMessageId: `history-key-${i}`,
        question: `历史问题${i}`,
        answer: `历史回答${i}`,
        status: "COMPLETED" as const,
        attemptId: randomUUID(),
        leaseExpiresAt: createdAt,
        createdAt,
      })),
    });
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = coachChatHistorySchema.parse(
        (await get(cursor ? `?before=${cursor}` : "").expect(200)).body,
      );
      expect(page.turns.length).toBeLessThanOrEqual(20);
      ids.push(...page.turns.map((row) => row.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(45);
    expect(new Set(ids).size).toBe(45);
    await send({
      clientMessageId: "new-question-key",
      message: "接着解释",
    }).expect(201);
    const messages = model.generate.mock.calls[0][0].messages;
    expect(
      messages.filter((m: { role: string }) => m.role === "assistant"),
    ).toHaveLength(3);
    expect(
      messages.filter((m: { role: string }) => m.role === "user"),
    ).toHaveLength(4);
  });

  it("persists safe failures, checks retry versions and retries without adding another question", async () => {
    await seedPlan();
    model.generate.mockRejectedValueOnce(
      new AiException(
        "AI_PROVIDER_TIMEOUT",
        "secret upstream diagnostic",
        true,
      ),
    );
    const input = {
      clientMessageId: "failed-question-key",
      message: "恢复怎么安排？",
    };
    const failed = (await send(input).expect(201)).body;
    expect(failed).toMatchObject({
      status: "FAILED",
      version: 2,
      answer: null,
      errorMessage: "AI 回答超时，请稍后重试",
    });
    expect(JSON.stringify(failed)).not.toContain("secret");
    await send({ ...input, expectedVersion: 1 }).expect(409);
    expect(
      (await send({ ...input, expectedVersion: failed.version }).expect(201))
        .body,
    ).toMatchObject({ id: failed.id, status: "COMPLETED", version: 4 });
    expect(await prisma.coachChatTurn.count({ where: { userId } })).toBe(1);
  });

  it("reuses an in-flight send, blocks another concurrent question and fences expired attempts", async () => {
    const input = {
      clientMessageId: "pending-question-key",
      message: "解释当前计划",
      expectedVersion: 0,
    };
    const initial = await repository.claim(userId, input);
    expect((await send(input).expect(201)).body.status).toBe("PROCESSING");
    expect(model.generate).not.toHaveBeenCalled();
    await send({
      clientMessageId: "another-question-key",
      message: "另一个问题",
    }).expect(409);
    await prisma.coachChatTurn.update({
      where: { id: initial.row.id },
      data: { leaseExpiresAt: new Date(0) },
    });
    expect(
      (await get(`/${input.clientMessageId}`).expect(200)).body.turn,
    ).toMatchObject({ status: "FAILED", errorMessage: "回复已中断，请重试" });
    const retry = await repository.claim(userId, {
      ...input,
      expectedVersion: 1,
    });
    const old = await repository.finish(initial.row, {
      answer: "过期尝试的结果",
    });
    expect(old).toMatchObject({
      status: "PROCESSING",
      attemptId: retry.row.attemptId,
      answer: null,
    });
    await repository.finish(retry.row, { answer: "当前尝试的结果" });
    expect(
      (await get(`/${input.clientMessageId}`).expect(200)).body.turn.answer,
    ).toBe("当前尝试的结果");
  });

  it("preserves no-plan questions as failed without invoking the model or writing plans", async () => {
    expect(
      (
        await send({
          clientMessageId: "no-plan-question-key",
          message: "解释训练",
        }).expect(201)
      ).body,
    ).toMatchObject({ status: "FAILED", errorMessage: "请先建立正式训练计划" });
    expect(model.generate).not.toHaveBeenCalled();
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
  });
});
