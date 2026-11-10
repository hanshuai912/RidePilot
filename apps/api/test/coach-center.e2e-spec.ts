import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { AiService } from "../src/ai/ai.service";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { AiGenerationService } from "../src/modules/coach/ai-generation.service";
import { NutritionGenerationService } from "../src/modules/nutrition/nutrition-generation.service";
import { CoachOverviewService } from "../src/modules/coach/coach-overview.service";
import { AiException } from "../src/ai/exceptions/ai.exception";
import { goalResponse } from "../src/modules/coach/goals/goal-lifecycle.repository";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
describeDb("AI coach collaboration center", () => {
  jest.setTimeout(30_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const users: string[] = [];
  const model = { generate: jest.fn() };
  const get = (path: string, access = token) =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${access}`);
  const post = (path: string, access = token) =>
    request(app.getHttpServer())
      .post(`/api/v1/${path}`)
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
  const seedPlan = async () => {
    const plan = await prisma.trainingPlan.create({
      data: { userId, status: "ACTIVE" },
    });
    const version = await prisma.planVersion.create({
      data: {
        planId: plan.id,
        versionNo: 1,
        appliedAt: new Date("2029-01-01"),
        changeReason: "初始安排",
      },
    });
    await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { activeVersionId: version.id },
    });
    return { plan, version };
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
  });
  beforeEach(async () => {
    const auth = await register();
    userId = auth.user.id;
    token = auth.tokens.accessToken;
    await prisma.user.update({
      where: { id: userId },
      data: { timezone: "Asia/Shanghai" },
    });
    model.generate.mockReset().mockResolvedValue({
      text: "下一节训练用于耐力发展。调整请从结构化任务入口预览草稿。",
      model: "mock-coach",
      requestId: randomUUID(),
    });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });

  it("requires authentication for all center endpoints", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/ai-coach/overview")
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/ai-coach/suggestions")
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/ai-coach/suggestions/${randomUUID()}/dismiss`)
      .send({ kind: "TRAINING", expectedVersion: 1 })
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/ai-coach/chat")
      .send({ message: "解释训练" })
      .expect(401);
  });
  it("returns honest empty states and never generates on reads", async () => {
    const overview = (await get("ai-coach/overview").expect(200)).body;
    expect(overview).toMatchObject({
      planVersion: 0,
      goal: null,
      stage: null,
      nextWorkout: null,
      nextAssessment: null,
      status: { code: "INSUFFICIENT" },
    });
    expect((await get("ai-coach/suggestions").expect(200)).body).toEqual({
      pending: [],
      recent: [],
    });
    expect(await prisma.aiGeneration.count({ where: { userId } })).toBe(0);
    expect(model.generate).not.toHaveBeenCalled();
    await post("ai-coach/chat").send({ message: "解释训练" }).expect(400);
  });
  it("reads a consistent real stage, evidence, next unrecorded workout and overdue test", async () => {
    const { version } = await seedPlan();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ftp = await prisma.abilityMeasurement.create({
      data: {
        userId,
        metricType: "FTP",
        unit: "W",
        value: 250,
        source: "MANUAL",
        measuredAt: new Date("2030-01-01"),
      },
    });
    const availability = await prisma.trainingAvailability.create({
      data: {
        userId,
        timezone: "Asia/Shanghai",
        weekdays: [],
        maxSessionMinutes: 90,
      },
    });
    const goal = await prisma.trainingGoal.create({
      data: {
        userId,
        type: "FTP",
        priority: "PRIMARY",
        status: "ACTIVE",
        targetDate: new Date("2030-03-01"),
      },
    });
    const stage = await prisma.trainingStagePlan.create({
      data: {
        userId,
        goalId: goal.id,
        goalVersion: goal.version,
        goalsSnapshot: { goals: [goalResponse(goal)], tradeoffs: [] },
        profileVersion: user.profileVersion,
        ftpMeasurementId: ftp.id,
        availabilityVersion: availability.version,
        generationId: randomUUID(),
        status: "ACTIVE",
        summary: "阶段安排",
        startDate: new Date("2030-01-01"),
        endDate: new Date("2030-01-31"),
        model: "mock",
        skillVersion: "test",
        stages: {
          create: {
            position: 0,
            title: "基础阶段",
            purpose: "积累耐力",
            startDate: new Date("2030-01-01"),
            endDate: new Date("2030-01-31"),
            assessmentSuggestion: "月末复评",
          },
        },
      },
    });
    const original = randomUUID();
    await prisma.workout.create({
      data: {
        planVersionId: version.id,
        sportType: "CYCLING",
        scheduledDate: new Date("2030-01-09"),
        dayOrder: 0,
        source: "AI",
        structure: { activityWorkoutId: original },
      },
    });
    const next = await prisma.workout.create({
      data: {
        planVersionId: version.id,
        sportType: "CYCLING",
        title: "耐力训练",
        scheduledDate: new Date("2030-01-10"),
        dayOrder: 0,
        source: "AI",
        structure: {},
      },
    });
    await prisma.trainingActivity.create({
      data: {
        userId,
        workoutId: original,
        localDate: new Date("2030-01-09"),
        status: "SKIPPED",
        rpe: 9,
        fatigue: 8,
      },
    });
    const test = await prisma.trainingAssessment.create({
      data: {
        userId,
        kind: "FTP",
        localDate: new Date("2030-01-08"),
        protocol: "FTP_TEST",
        status: "SCHEDULED",
      },
    });
    const overview = await app
      .get(CoachOverviewService)
      .get(userId, new Date("2030-01-08T23:30:00Z"));
    expect(overview).toMatchObject({
      localDate: "2030-01-09",
      stage: { title: "基础阶段", upcoming: false },
      status: { code: "RECOVERING" },
      nextWorkout: { id: next.id },
      nextAssessment: { id: test.id, overdue: true },
    });
    expect(overview.upcomingWorkouts.map((w) => w.id)).toEqual([next.id]);
    await prisma.user.update({
      where: { id: userId },
      data: { profileVersion: { increment: 1 } },
    });
    const stale = await app
      .get(CoachOverviewService)
      .get(userId, new Date("2030-01-09"));
    expect(stale.stage).toBeNull();
    expect(stale.stageNotice).toContain("已变化");
    expect(
      await prisma.trainingStagePlan.findUnique({ where: { id: stage.id } }),
    ).toMatchObject({ status: "ACTIVE" });
  });
  it("archives stale work without mutation, keeps it visible beyond recent history, and isolates users", async () => {
    await seedPlan();
    const pending = await prisma.changeProposal.create({
      data: {
        userId,
        proposalType: "AI_WEEK_PLAN",
        status: "READY",
        draft: { summary: "旧训练建议" },
        createdAt: new Date("2020-01-01"),
      },
    });
    await prisma.changeProposal.createMany({
      data: Array.from({ length: 55 }, () => ({
        userId,
        proposalType: "AI_WEEK_PLAN" as const,
        status: "APPLIED" as const,
        draft: {},
      })),
    });
    const food = await prisma.nutritionProposal.create({
      data: { userId, proposalType: "AI_PLAN", status: "READY", draft: {} },
    });
    const job = await prisma.aiGeneration.create({
      data: {
        userId,
        scene: "NUTRITION_PLAN",
        status: "RUNNING",
        input: {},
        idempotencyKey: randomUUID(),
      },
    });
    const list = (await get("ai-coach/suggestions").expect(200)).body;
    expect(list.pending).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: food.id, kind: "NUTRITION" }),
        expect.objectContaining({ id: job.id, kind: "GENERATION" }),
      ]),
    );
    expect(list.pending.some((p: { id: string }) => p.id === pending.id)).toBe(
      false,
    );
    expect(list.recent).toHaveLength(11);
    expect(list.recent).toContainEqual(
      expect.objectContaining({
        id: pending.id,
        status: "EXPIRED",
        staleReason: expect.stringContaining("版本已变化"),
      }),
    );
    expect(
      await prisma.changeProposal.findUnique({ where: { id: pending.id } }),
    ).toMatchObject({ status: "READY", proposalVersion: 1 });
    const other = await register();
    expect(
      (await get("ai-coach/suggestions", other.tokens.accessToken).expect(200))
        .body.pending,
    ).toEqual([]);
    await post(
      `ai-coach/suggestions/${pending.id}/dismiss`,
      other.tokens.accessToken,
    )
      .send({ kind: "TRAINING", expectedVersion: 1 })
      .expect(404);
    await post(`ai-coach/suggestions/${pending.id}/dismiss`)
      .send({ kind: "TRAINING", expectedVersion: 2 })
      .expect(409);
    for (let i = 0; i < 2; i++)
      await post(`ai-coach/suggestions/${pending.id}/dismiss`)
        .send({ kind: "TRAINING", expectedVersion: 1 })
        .expect(201);
    expect(
      await prisma.changeProposal.findUnique({ where: { id: pending.id } }),
    ).toMatchObject({ status: "REJECTED", proposalVersion: 2 });
    expect(
      (await get("ai-coach/suggestions").expect(200)).body.pending.some(
        (p: { id: string }) => p.id === pending.id,
      ),
    ).toBe(false);
  });
  it("rejects applying a changed training or nutrition draft before writing a version", async () => {
    const training = await prisma.changeProposal.create({
      data: {
        userId,
        proposalType: "AI_WEEK_PLAN",
        status: "READY",
        proposalVersion: 2,
        validationPassed: true,
        draft: {},
      },
    });
    await post(`proposals/${training.id}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0, expectedProposalVersion: 1 })
      .expect(409);
    const food = await prisma.nutritionProposal.create({
      data: {
        userId,
        proposalType: "AI_PLAN",
        status: "READY",
        proposalVersion: 2,
        validationPassed: true,
        draft: {},
      },
    });
    await post(`nutrition/proposals/${food.id}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedNutritionVersion: 0, expectedProposalVersion: 1 })
      .expect(409);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    expect(await prisma.nutritionPlan.count({ where: { userId } })).toBe(0);
  });

  it("dismisses nutrition and stage drafts idempotently and protects applied suggestions", async () => {
    const food = await prisma.nutritionProposal.create({
      data: { userId, proposalType: "AI_PLAN", status: "READY", draft: {} },
    });
    const goal = await prisma.trainingGoal.create({
      data: {
        userId,
        type: "ENDURANCE",
        priority: "PRIMARY",
        targetDate: new Date("2030-03-01"),
      },
    });
    const stage = await prisma.trainingStagePlan.create({
      data: {
        userId,
        goalId: goal.id,
        goalVersion: 1,
        profileVersion: 1,
        ftpMeasurementId: randomUUID(),
        availabilityVersion: 1,
        generationId: randomUUID(),
        status: "DRAFT",
        summary: "阶段建议",
        startDate: new Date("2030-01-01"),
        endDate: new Date("2030-01-31"),
        model: "mock",
        skillVersion: "test",
      },
    });
    for (const [id, kind] of [
      [food.id, "NUTRITION"],
      [stage.id, "STAGE"],
    ]) {
      for (let attempt = 0; attempt < 2; attempt++)
        await post(`ai-coach/suggestions/${id}/dismiss`)
          .send({ kind, expectedVersion: 1 })
          .expect(201);
    }
    expect(
      await prisma.nutritionProposal.findUnique({ where: { id: food.id } }),
    ).toMatchObject({ status: "REJECTED", proposalVersion: 2 });
    expect(
      await prisma.trainingStagePlan.findUnique({ where: { id: stage.id } }),
    ).toMatchObject({ status: "ARCHIVED", version: 2 });
    const applied = await prisma.changeProposal.create({
      data: {
        userId,
        proposalType: "AI_WEEK_PLAN",
        status: "APPLIED",
        draft: {},
      },
    });
    await post(`ai-coach/suggestions/${applied.id}/dismiss`)
      .send({ kind: "TRAINING", expectedVersion: 1 })
      .expect(409);
    const list = (await get("ai-coach/suggestions").expect(200)).body;
    expect(list.pending).toEqual([]);
    expect(list.recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: food.id, status: "REJECTED" }),
        expect.objectContaining({ id: stage.id, status: "ARCHIVED" }),
      ]),
    );
  });
  it("answers using current owned context and bounded conversation without changing data", async () => {
    const { version } = await seedPlan();
    await prisma.workout.create({
      data: {
        planVersionId: version.id,
        sportType: "CYCLING",
        title: "未来耐力",
        purpose: "发展耐力",
        scheduledDate: new Date("2099-01-01"),
        dayOrder: 0,
        source: "AI",
        structure: {},
      },
    });
    const response = await post("ai-coach/chat")
      .send({
        message: "帮我调整下一节",
        history: [
          { role: "user", content: "我本周时间很少" },
          { role: "assistant", content: "可以预览调整草稿" },
        ],
      })
      .expect(201);
    expect(response.body).toMatchObject({
      readOnly: true,
      model: "mock-coach",
    });
    const messages = model.generate.mock.calls[0][0].messages;
    expect(model.generate.mock.calls[0][0]).toMatchObject({
      thinkingMode: "disabled",
      maxTokens: 1600,
    });
    expect(JSON.parse(messages.at(-1).content).context).toMatchObject({
      planVersion: 1,
      nextWorkout: { title: "未来耐力" },
      status: { code: "INSUFFICIENT" },
    });
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "我本周时间很少" }),
      ]),
    );
    expect(await prisma.changeProposal.count({ where: { userId } })).toBe(0);
    expect(await prisma.aiGeneration.count({ where: { userId } })).toBe(0);
    await post("ai-coach/chat")
      .send({
        message: "问题",
        history: Array.from({ length: 7 }, () => ({
          role: "user",
          content: "过长对话",
        })),
      })
      .expect(400);
  });

  it.each([
    [
      "AI_PROVIDER_OUTPUT_TRUNCATED",
      502,
      "AI 回答未生成完整，请重试或缩小问题范围",
      true,
    ],
    ["AI_PROVIDER_INVALID_RESPONSE", 502, "AI 暂未返回有效回答，请重试", false],
    ["AI_PROVIDER_TIMEOUT", 504, "AI 回答超时，请稍后重试", true],
    ["AI_INPUT_REJECTED", 422, "这个问题暂时无法回答，请调整问题后重试", false],
  ] as const)(
    "returns a usable chat failure for %s and preserves read-only behavior",
    async (code, status, message, retryable) => {
      await seedPlan();
      model.generate.mockRejectedValueOnce(
        new AiException(code, "upstream diagnostic not for clients", retryable),
      );
      const failed = await post("ai-coach/chat")
        .send({ message: "为什么安排耐力训练？" })
        .expect(status);
      expect(failed.body).toEqual({
        statusCode: status,
        code,
        message,
        retryable,
      });
      expect(JSON.stringify(failed.body)).not.toContain("upstream diagnostic");
      expect(await prisma.changeProposal.count({ where: { userId } })).toBe(0);
      expect(await prisma.aiGeneration.count({ where: { userId } })).toBe(0);
      await post("ai-coach/chat")
        .send({ message: "为什么安排耐力训练？" })
        .expect(201);
    },
  );
});
