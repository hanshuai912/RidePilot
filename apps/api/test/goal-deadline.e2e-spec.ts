import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import { AiService } from "../src/ai/ai.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
describeDb("training goals without deadlines", () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let goalId: string;
  let start: string;
  const users: string[] = [];
  const model = { generate: jest.fn() };
  const post = (path: string, access = token) =>
    request(app.getHttpServer())
      .post(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${access}`);
  const get = (path: string, access = token) =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${access}`);
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
  const wait = async (id: string) => {
    for (let i = 0; i < 60; i++) {
      const job = (await get(`ai-coach/generations/${id}`).expect(200)).body;
      if (["READY", "FAILED"].includes(job.status)) return job;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("generation timeout");
  };
  const ftp = () =>
    post("me/ability-measurements/ftp")
      .send({
        valueWatts: 250,
        source: "MANUAL",
        measuredAt: new Date().toISOString(),
      })
      .expect(201);
  const generateStages = async (days = 13) => {
    const job = (
      await post("stage-plans/generate-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({ goalId, startDate: start, endDate: addDays(start, days) })
        .expect(202)
    ).body;
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("READY");
    return (await get(`stage-plans/${finished.proposalId}`).expect(200)).body;
  };
  const workout = (date: string, title = "新耐力课程") => ({
    scheduledDate: date,
    title,
    purpose: "基础耐力",
    segments: [
      {
        type: "work",
        target: { kind: "duration", value: 30, unit: "min" },
        intensity: { kind: "ftp_percent", min: 60, max: 70 },
      },
    ],
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue(model)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    const auth = await register();
    token = auth.tokens.accessToken;
    userId = auth.user.id;
    const now = new Date();
    start = addDays(
      now.toISOString().slice(0, 10),
      14 + ((8 - now.getUTCDay()) % 7),
    );
    await prisma.athleteProfile.upsert({
      where: { userId },
      create: { userId, experienceLevel: "INTERMEDIATE" },
      update: { experienceLevel: "INTERMEDIATE" },
    });
    await ftp();
    await request(app.getHttpServer())
      .put("/api/v1/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "UTC",
        weekdays: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          availableMinutes: 90,
        })),
        maxSessionMinutes: 90,
      })
      .expect(200);
    goalId = (
      await post("goals")
        .send({
          type: "ENDURANCE",
          priority: "PRIMARY",
        })
        .expect(201)
    ).body.id;
    model.generate.mockReset();
  });

  afterAll(async () => {
    if (prisma && users.length) {
      await prisma.trainingPlan.updateMany({
        where: { userId: { in: users } },
        data: { activeVersionId: null },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });

  it("creates goals without deadlines and ignores legacy deadlines in planning and AI context", async () => {
    const current = (await get(`goals/${goalId}`).expect(200)).body;
    expect(current).not.toHaveProperty("targetDate");
    expect(
      (await prisma.trainingGoal.findUniqueOrThrow({ where: { id: goalId } }))
        .targetDate,
    ).toBeNull();
    const legacyInput = {
      type: "CLIMBING",
      priority: "SECONDARY",
      targetDate: "2020-01-01",
    };
    const evaluation = (
      await post("goals/evaluate").send(legacyInput).expect(201)
    ).body;
    expect(evaluation.evaluation).not.toHaveProperty("daysRemaining");
    const key = randomUUID();
    const secondary = (
      await post("goals")
        .set("Idempotency-Key", key)
        .send(legacyInput)
        .expect(201)
    ).body;
    expect(secondary).not.toHaveProperty("targetDate");
    expect(
      (
        await prisma.trainingGoal.findUniqueOrThrow({
          where: { id: secondary.id },
        })
      ).targetDate,
    ).toBeNull();
    expect(
      (
        await post("goals")
          .set("Idempotency-Key", key)
          .send(legacyInput)
          .expect(201)
      ).body,
    ).toEqual(secondary);
    // A historical goal is still usable after its former deadline, without an extension.
    await prisma.trainingGoal.update({
      where: { id: goalId },
      data: { targetDate: new Date("2020-01-01") },
    });
    model.generate.mockImplementationOnce(
      async (input: { messages: { content: string }[] }) => {
        const payload = JSON.parse(input.messages.at(-1)!.content);
        expect(payload.goal).not.toHaveProperty("targetDate");
        expect(payload.planningGoals).toHaveLength(2);
        payload.planningGoals.forEach((goal: Record<string, unknown>) =>
          expect(goal).not.toHaveProperty("targetDate"),
        );
        return {
          text: JSON.stringify({
            summary: "按实际反馈推进",
            goalTradeoffs: [],
            stages: [
              {
                title: "耐力基础",
                purpose: "逐步积累",
                startDate: start,
                endDate: addDays(start, 13),
                assessmentSuggestion: "记录实际训练感受",
              },
            ],
          }),
          model: "mock-no-deadline",
        };
      },
    );
    const stageDraft = await generateStages();
    expect(stageDraft.endDate).toBe(addDays(start, 13));
    model.generate.mockImplementationOnce(
      async (input: { messages: { content: string }[] }) => {
        const payload = JSON.parse(input.messages.at(-1)!.content);
        expect(payload.goal).not.toHaveProperty("targetDate");
        payload.planningGoals.forEach((goal: Record<string, unknown>) =>
          expect(goal).not.toHaveProperty("targetDate"),
        );
        return {
          text: JSON.stringify({
            summary: "滚动规划",
            stageSummary: "耐力基础",
            assessmentSuggestion: "阶段复评",
            goalTradeoffs: [],
            workouts: [workout(start)],
          }),
          model: "mock-no-deadline",
        };
      },
    );
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "DATES",
          goalId,
          startDate: start,
          endDate: addDays(start, 6),
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    expect((await wait(job.generationId)).status).toBe("READY");
    await post("plans/generate-range-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        scope: "DATES",
        goalId,
        startDate: start,
        endDate: addDays(start, 84),
        expectedBaseVersion: 0,
      })
      .expect(400);
  });
});
