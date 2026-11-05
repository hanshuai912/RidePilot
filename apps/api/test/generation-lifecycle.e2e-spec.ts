import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import type {
  NutritionGenerationInput,
  WeekGenerationInput,
} from "@ridepilot/contracts";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { AiService } from "../src/ai/ai.service";
import { AiException } from "../src/ai/exceptions/ai.exception";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { AiGenerationService } from "../src/modules/coach/ai-generation.service";
import { StagePlansService } from "../src/modules/coach/stage-plans.service";
import { NutritionGenerationService } from "../src/modules/nutrition/nutrition-generation.service";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
describeDb("coach generation candidate lifecycle", () => {
  jest.setTimeout(30_000);
  let app: INestApplication;
  let db: PrismaService;
  let training: AiGenerationService;
  let nutrition: NutritionGenerationService;
  let userId: string;
  let token: string;
  let goalId: string;
  let start: string;
  const users: string[] = [];
  const model = { generate: jest.fn() };
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${token}`);
  const post = (path: string) =>
    request(app.getHttpServer())
      .post(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${token}`);
  const add = (date: string, days: number) =>
    new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
  const input = (): WeekGenerationInput => ({
    goalId,
    weekStartDate: start,
    mode: "initial",
    expectedBaseVersion: 0,
  });
  const foodInput = (): NutritionGenerationInput => ({
    startDate: start,
    endDate: start,
    mode: "INITIAL",
    expectedNutritionVersion: 0,
  });
  const process = async (id: string, kind = "TRAINING") => {
    await db.aiGeneration.update({
      where: { id },
      data: { status: "RUNNING", attempts: 1 },
    });
    if (kind === "TRAINING") await training.process(id);
    else
      await (
        nutrition as unknown as { process: (id: string) => Promise<void> }
      ).process(id);
    return db.aiGeneration.findUniqueOrThrow({ where: { id } });
  };
  const trainingOutput = () => ({
    summary: "耐力草稿",
    stageSummary: "基础阶段",
    assessmentSuggestion: "稍后复评",
    workouts: [
      {
        scheduledDate: start,
        title: "耐力训练",
        purpose: "积累耐力",
        segments: [
          {
            type: "work",
            target: { kind: "duration", value: 30, unit: "min" },
            intensity: { kind: "ftp_percent", min: 60, max: 70 },
          },
        ],
      },
    ],
  });
  const nutritionOutput = (blockers: string[] = []) => ({
    summary: "早餐补给",
    assumptions: [],
    warnings: [],
    blockers,
    sourceRefs: [],
    confidence: "MEDIUM",
    draft: {
      startDate: start,
      endDate: start,
      dailyTarget: null,
      items: [
        {
          localDate: start,
          mealType: "BREAKFAST",
          scheduledLocalTime: "07:30",
          title: "米饭早餐",
          foods: [
            {
              name: "米饭",
              amount: 150,
              unit: "g",
              allergenTags: [],
              ingredientStatus: "KNOWN",
            },
          ],
          nutrients: {
            energyKcal: 220,
            carbohydrateG: 45,
            proteinG: 4,
            fatG: 1,
            fluidMl: null,
            sodiumMg: null,
          },
          nutritionSource: "AI_ESTIMATE",
          confidence: "MEDIUM",
          linkedWorkoutId: null,
          notes: null,
        },
      ],
    },
  });
  const answer = (output: unknown) => ({
    text: JSON.stringify(output),
    model: "lifecycle-test",
    requestId: randomUUID(),
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue(model)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    training = app.get(AiGenerationService);
    nutrition = app.get(NutritionGenerationService);
    training.onModuleDestroy();
    nutrition.onModuleDestroy();
  });
  beforeEach(async () => {
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
    userId = auth.user.id;
    token = auth.tokens.accessToken;
    users.push(userId);
    const now = new Date();
    start = add(
      now.toISOString().slice(0, 10),
      14 + ((8 - now.getUTCDay()) % 7),
    );
    await db.athleteProfile.upsert({
      where: { userId },
      create: { userId, experienceLevel: "INTERMEDIATE" },
      update: { experienceLevel: "INTERMEDIATE" },
    });
    await db.abilityMeasurement.create({
      data: {
        userId,
        metricType: "FTP",
        unit: "W",
        value: 250,
        source: "MANUAL",
        measuredAt: new Date(),
      },
    });
    await db.trainingAvailability.create({
      data: {
        userId,
        timezone: "UTC",
        weekdays: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          availableMinutes: 90,
        })),
        maxSessionMinutes: 90,
      },
    });
    goalId = (
      await post("goals")
        .send({
          type: "ENDURANCE",
          targetDate: add(start, 180),
          priority: "PRIMARY",
        })
        .expect(201)
    ).body.id;
    await request(app.getHttpServer())
      .put("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        dietStyle: "OMNIVORE",
        habits: [],
        allergens: [],
        restrictions: [],
        commonFoods: [],
        mealSchedule: [{ mealType: "BREAKFAST", localTime: "07:30" }],
      })
      .expect(200);
    model.generate
      .mockReset()
      .mockImplementation(async () => answer(trainingOutput()));
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });

  it("serializes duplicate clicks across keys, resumes ready drafts and preserves one on failed regeneration", async () => {
    const jobs = await Promise.all([
      training.submit(userId, input(), randomUUID()),
      training.submit(userId, input(), randomUUID()),
    ]);
    expect(jobs[0].generationId).toBe(jobs[1].generationId);
    expect(
      (
        await training.submit(
          userId,
          { ...input(), forceRegenerate: true },
          randomUUID(),
        )
      ).generationId,
    ).toBe(jobs[0].generationId);
    const original = await process(jobs[0].generationId);
    expect(original.status).toBe("READY");
    expect(
      (await training.submit(userId, input(), randomUUID())).proposalId,
    ).toBe(original.proposalId);
    const regenerated = await training.submit(
      userId,
      { ...input(), forceRegenerate: true },
      randomUUID(),
    );
    expect(regenerated.generationId).not.toBe(original.id);
    model.generate.mockRejectedValueOnce(
      new AiException("AI_PROVIDER_INVALID_RESPONSE", "failed", false),
    );
    expect((await process(regenerated.generationId)).status).toBe("FAILED");
    expect(
      await db.changeProposal.findUnique({
        where: { id: original.proposalId! },
      }),
    ).toMatchObject({ status: "READY", proposalVersion: 1 });
    expect(
      (await training.submit(userId, input(), randomUUID())).proposalId,
    ).toBe(original.proposalId);
    expect(await db.trainingPlan.count({ where: { userId } })).toBe(0);
  });

  it("retires only the same task after success and refuses to apply superseded drafts", async () => {
    const a = await training.submit(userId, input(), randomUUID());
    const first = await process(a.generationId);
    const other = await training.submit(
      userId,
      { ...input(), weekStartDate: add(start, 7) },
      randomUUID(),
    );
    model.generate.mockResolvedValueOnce(
      answer({
        ...trainingOutput(),
        workouts: trainingOutput().workouts.map((w) => ({
          ...w,
          scheduledDate: add(start, 7),
        })),
      }),
    );
    const unrelated = await process(other.generationId);
    expect(unrelated.status).toBe("READY");
    const next = await training.submit(
      userId,
      { ...input(), forceRegenerate: true, notes: "缩短训练" },
      randomUUID(),
    );
    const newer = await process(next.generationId);
    expect(newer.status).toBe("READY");
    expect(
      await db.changeProposal.findUnique({ where: { id: first.proposalId! } }),
    ).toMatchObject({
      status: "EXPIRED",
      proposalVersion: 2,
      validationPassed: false,
    });
    expect(
      await db.changeProposal.findUnique({
        where: { id: unrelated.proposalId! },
      }),
    ).toMatchObject({ status: "READY", proposalVersion: 1 });
    const list = (await get("ai-coach/suggestions").expect(200)).body;
    expect(list.pending.map((p: { id: string }) => p.id)).toEqual(
      expect.arrayContaining([newer.proposalId, unrelated.proposalId]),
    );
    expect(list.recent).toContainEqual(
      expect.objectContaining({
        id: first.proposalId,
        status: "SUPERSEDED",
        staleReason: expect.stringContaining("替代"),
      }),
    );
    await post(`proposals/${first.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0 })
      .expect(409);
    expect(await db.trainingPlan.count({ where: { userId } })).toBe(0);
  });

  it("keeps the newer successful request when an older worker finishes late", async () => {
    const older = await training.submit(userId, input(), randomUUID());
    const newer = await training.submit(
      userId,
      { ...input(), notes: "新要求", forceRegenerate: true },
      randomUUID(),
    );
    const current = await process(newer.generationId);
    expect(current.status).toBe("READY");
    const late = await process(older.generationId);
    expect(late.status).toBe("READY");
    expect(
      await db.changeProposal.findUnique({
        where: { id: current.proposalId! },
      }),
    ).toMatchObject({ status: "READY" });
    expect(
      await db.changeProposal.findUnique({ where: { id: late.proposalId! } }),
    ).toMatchObject({ status: "EXPIRED" });
  });

  it("rejects context changes during model generation and leaves existing drafts intact", async () => {
    const original = await process(
      (await training.submit(userId, input(), randomUUID())).generationId,
    );
    const job = await training.submit(
      userId,
      { ...input(), forceRegenerate: true },
      randomUUID(),
    );
    model.generate.mockImplementationOnce(async () => {
      await db.user.update({
        where: { id: userId },
        data: { profileVersion: { increment: 1 } },
      });
      return answer(trainingOutput());
    });
    expect(await process(job.generationId)).toMatchObject({
      status: "FAILED",
      errorCode: "GENERATION_CONTEXT_CHANGED",
    });
    expect(
      await db.changeProposal.findUnique({
        where: { id: original.proposalId! },
      }),
    ).toMatchObject({ status: "READY", proposalVersion: 1 });
    const list = (await get("ai-coach/suggestions").expect(200)).body;
    expect(list.pending).toEqual([]);
    expect(list.recent).toContainEqual(
      expect.objectContaining({
        id: original.proposalId,
        status: "EXPIRED",
        staleReason: expect.stringContaining("基本资料"),
      }),
    );
    const fresh = await training.submit(userId, input(), randomUUID());
    expect(fresh.generationId).not.toBe(original.id);
  });

  it("does not let a newer stale candidate supersede an older queued task generated with current inputs", async () => {
    const older = await training.submit(
      userId,
      { ...input(), notes: "原任务" },
      randomUUID(),
    );
    const newer = await training.submit(
      userId,
      { ...input(), notes: "另一要求" },
      randomUUID(),
    );
    const stale = await process(newer.generationId);
    await db.user.update({
      where: { id: userId },
      data: { profileVersion: { increment: 1 } },
    });
    const current = await process(older.generationId);
    expect(current.status).toBe("READY");
    expect(
      await db.changeProposal.findUnique({
        where: { id: current.proposalId! },
      }),
    ).toMatchObject({ status: "READY" });
    const list = (await get("ai-coach/suggestions").expect(200)).body;
    expect(list.pending.map((p: { id: string }) => p.id)).toEqual([
      current.proposalId,
    ]);
    expect(list.recent).toContainEqual(
      expect.objectContaining({ id: stale.proposalId, status: "EXPIRED" }),
    );
  });

  it("deduplicates stage drafts and explicitly regenerates without activating them", async () => {
    const stages = app.get(StagePlansService);
    const params = { goalId, startDate: start, endDate: add(start, 13) };
    model.generate.mockResolvedValue(
      answer({
        summary: "阶段安排",
        stages: [
          {
            title: "基础",
            purpose: "耐力",
            startDate: start,
            endDate: add(start, 13),
            assessmentSuggestion: "之后复评",
          },
        ],
      }),
    );
    const a = await stages.submit(userId, params, randomUUID());
    expect(
      (await stages.submit(userId, params, randomUUID())).generationId,
    ).toBe(a.generationId);
    const first = await process(a.generationId);
    expect(first.status).toBe("READY");
    expect((await stages.submit(userId, params, randomUUID())).proposalId).toBe(
      first.proposalId,
    );
    const b = await stages.submit(
      userId,
      { ...params, forceRegenerate: true },
      randomUUID(),
    );
    const second = await process(b.generationId);
    expect(second.status).toBe("READY");
    expect(await stages.get(userId, first.proposalId!)).toMatchObject({
      status: "SUPERSEDED",
      version: 2,
    });
    await expect(
      stages.activate(userId, first.proposalId!, 1),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await db.trainingStagePlan.count({ where: { userId, status: "ACTIVE" } }),
    ).toBe(0);
  });

  it("deduplicates nutrition and preserves a ready candidate when a new one is blocked", async () => {
    model.generate.mockResolvedValue(answer(nutritionOutput()));
    const jobs = await Promise.all([
      nutrition.submit(userId, foodInput(), randomUUID()),
      nutrition.submit(userId, foodInput(), randomUUID()),
    ]);
    expect(jobs[0].generationId).toBe(jobs[1].generationId);
    const first = await process(jobs[0].generationId, "NUTRITION");
    expect(first.status).toBe("READY");
    expect(
      (await nutrition.submit(userId, foodInput(), randomUUID())).proposalId,
    ).toBe(first.proposalId);
    model.generate.mockResolvedValueOnce(
      answer(nutritionOutput(["需要确认补给耐受"])),
    );
    const blocked = await process(
      (
        await nutrition.submit(
          userId,
          { ...foodInput(), forceRegenerate: true },
          randomUUID(),
        )
      ).generationId,
      "NUTRITION",
    );
    expect(
      await db.nutritionProposal.findUnique({
        where: { id: blocked.proposalId! },
      }),
    ).toMatchObject({ status: "BLOCKED" });
    expect(
      await db.nutritionProposal.findUnique({
        where: { id: first.proposalId! },
      }),
    ).toMatchObject({ status: "READY", proposalVersion: 1 });
    const latest = await process(
      (
        await nutrition.submit(
          userId,
          { ...foodInput(), forceRegenerate: true },
          randomUUID(),
        )
      ).generationId,
      "NUTRITION",
    );
    expect(latest.status).toBe("READY");
    for (const id of [first.proposalId!, blocked.proposalId!])
      expect(
        await db.nutritionProposal.findUnique({ where: { id } }),
      ).toMatchObject({ status: "EXPIRED", proposalVersion: 2 });
    expect(await db.nutritionPlan.count({ where: { userId } })).toBe(0);
  });

  it("moves dependent drafts to history after explicit application", async () => {
    model.generate.mockResolvedValue(answer(nutritionOutput()));
    const food = await process(
      (await nutrition.submit(userId, foodInput(), randomUUID())).generationId,
      "NUTRITION",
    );
    model.generate.mockResolvedValue(answer(trainingOutput()));
    const ready = await process(
      (await training.submit(userId, input(), randomUUID())).generationId,
    );
    await post(`proposals/${ready.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0, expectedProposalVersion: 1 })
      .expect(201);
    const list = (await get("ai-coach/suggestions").expect(200)).body;
    expect(list.pending).toEqual([]);
    expect(list.recent).toContainEqual(
      expect.objectContaining({
        id: food.proposalId,
        status: "EXPIRED",
        staleReason: expect.stringContaining("训练版本"),
      }),
    );
    await post(`nutrition/proposals/${food.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedNutritionVersion: 0, expectedProposalVersion: 1 })
      .expect(409);
    expect(await db.nutritionPlan.count({ where: { userId } })).toBe(0);
  });

  it("rejects nutrition drafts after dietary profile changes and does not reuse them", async () => {
    model.generate.mockResolvedValue(answer(nutritionOutput()));
    const first = await process(
      (await nutrition.submit(userId, foodInput(), randomUUID())).generationId,
      "NUTRITION",
    );
    await db.nutritionProfile.update({
      where: { userId },
      data: { version: { increment: 1 } },
    });
    const list = (await get("ai-coach/suggestions").expect(200)).body;
    expect(list.pending).toEqual([]);
    expect(list.recent).toContainEqual(
      expect.objectContaining({
        id: first.proposalId,
        status: "EXPIRED",
        staleReason: expect.stringContaining("饮食档案"),
      }),
    );
    const rejected = await post(`nutrition/proposals/${first.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedNutritionVersion: 0, expectedProposalVersion: 1 })
      .expect(409);
    expect(rejected.body.code).toBe("NUTRITION_GENERATION_STALE");
    expect(
      (await nutrition.submit(userId, foodInput(), randomUUID())).generationId,
    ).not.toBe(first.id);
    expect(await db.nutritionPlan.count({ where: { userId } })).toBe(0);
  });

  it("retains exact-key conflicts and owner isolation", async () => {
    const key = randomUUID();
    const a = await training.submit(userId, input(), key);
    await expect(
      training.submit(userId, { ...input(), notes: "其他请求" }, key),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      training.get(randomUUID(), a.generationId),
    ).rejects.toMatchObject({ status: 404 });
    const expired = await process(a.generationId);
    await db.changeProposal.update({
      where: { id: expired.proposalId! },
      data: { expiresAt: new Date("2020-01-01") },
    });
    expect(
      (await training.submit(userId, input(), randomUUID())).generationId,
    ).not.toBe(a.generationId);
    await post(`proposals/${expired.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0 })
      .expect(409);
  });
});
