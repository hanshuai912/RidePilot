import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import type {
  CycleReviewGeneration,
  CycleReviewSnapshot,
} from "@ridepilot/contracts";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { AiService } from "../src/ai/ai.service";
import { AiException } from "../src/ai/exceptions/ai.exception";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { AiGenerationService } from "../src/modules/coach/ai-generation.service";
import { NutritionGenerationService } from "../src/modules/nutrition/nutrition-generation.service";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
describeDb("training cycle review workflow", () => {
  jest.setTimeout(30000);
  let app: INestApplication, db: PrismaService, worker: AiGenerationService;
  let userId: string,
    token: string,
    goalId: string,
    versionId: string,
    today: string,
    tomorrow: string;
  const users: string[] = [],
    workoutIds: string[] = [];
  const model = { generate: jest.fn() };
  const add = (date: string, n: number) =>
    new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
  const get = (path = "ai-coach/cycle-review") =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${token}`);
  const post = (path: string) =>
    request(app.getHttpServer())
      .post(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${token}`);
  const summary = async () =>
    (await get().expect(200)).body as CycleReviewSnapshot;
  const input = async (
    action: CycleReviewGeneration["review"]["action"] = "CONTINUE",
  ): Promise<CycleReviewGeneration> => {
    const r = await summary();
    return {
      review: {
        startDate: r.startDate,
        endDate: r.endDate,
        fingerprint: r.fingerprint,
        action,
      },
      goalId,
      startDate: tomorrow,
      endDate: tomorrow,
      expectedBaseVersion: 1,
    };
  };
  const generate = (body: CycleReviewGeneration, key = randomUUID()) =>
    post("ai-coach/cycle-review/generate-proposal")
      .set("Idempotency-Key", key)
      .send(body);
  const output = (max = 70) => ({
    summary: "根据复盘安排后续耐力训练",
    stageSummary: "保留当前目标",
    assessmentSuggestion: "按需测试",
    workouts: [
      {
        scheduledDate: tomorrow,
        title: "后续骑行",
        purpose: "积累耐力",
        segments: [
          {
            type: "work",
            target: { kind: "duration", value: 30, unit: "min" },
            intensity: { kind: "ftp_percent", min: 55, max },
          },
        ],
      },
    ],
  });
  const processJob = async (id: string) => {
    await db.aiGeneration.update({
      where: { id },
      data: { status: "RUNNING", attempts: 2 },
    });
    await worker.process(id);
    return db.aiGeneration.findUniqueOrThrow({ where: { id } });
  };
  const ready = async (
    action: CycleReviewGeneration["review"]["action"] = "CONTINUE",
  ) => {
    const job = (await generate(await input(action)).expect(202)).body;
    const result = await processJob(job.generationId);
    expect(result).toMatchObject({ status: "READY" });
    return result.proposalId!;
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue(model)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    worker = app.get(AiGenerationService);
    worker.onModuleDestroy();
    app.get(NutritionGenerationService).onModuleDestroy();
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
    await db.user.update({ where: { id: userId }, data: { timezone: "UTC" } });
    today = new Date().toISOString().slice(0, 10);
    tomorrow = add(today, 1);
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
          priority: "PRIMARY",
          targetDate: add(today, 90),
        })
        .expect(201)
    ).body.id;
    const plan = await db.trainingPlan.create({
      data: { userId, status: "ACTIVE" },
    });
    const version = await db.planVersion.create({
      data: {
        planId: plan.id,
        versionNo: 1,
        appliedAt: new Date(Date.now() - 7 * 86400000),
      },
    });
    versionId = version.id;
    await db.trainingPlan.update({
      where: { id: plan.id },
      data: { activeVersionId: version.id },
    });
    workoutIds.length = 0;
    for (let i = 0; i < 4; i++) {
      const w = await db.workout.create({
        data: {
          planVersionId: version.id,
          sportType: "cycling",
          source: "manual",
          title: `周期训练${i + 1}`,
          scheduledDate: new Date(add(today, i - 3)),
          dayOrder: 1,
          timeTargetMin: i === 1 ? null : 60,
          structure: { segments: [] },
        },
      });
      workoutIds.push(w.id);
    }
    for (const [i, status] of ["COMPLETED", "PARTIAL", "SKIPPED"].entries())
      await db.trainingActivity.create({
        data: {
          userId,
          workoutId: workoutIds[i],
          localDate: new Date(add(today, i - 3)),
          status,
          durationMin: i === 0 ? 45 : i === 2 ? 0 : null,
          rpe: i === 0 ? 6 : null,
          fatigue: i === 1 ? 8 : null,
        },
      });
    model.generate.mockReset().mockImplementation(async () => ({
      text: JSON.stringify(output()),
      model: "cycle-test",
      requestId: randomUUID(),
    }));
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });

  it("reads honest denominators, partial durations and recent fatigue without generating or writing", async () => {
    const before = await db.changeProposal.count({ where: { userId } });
    const r = await summary();
    expect(r.stats).toMatchObject({
      planned: 4,
      completed: 1,
      partial: 1,
      skipped: 1,
      unrecorded: 1,
      completionRate: 25,
      plannedMinutes: 180,
      plannedDurationCount: 3,
      actualMinutes: 45,
      actualDurationCount: 2,
      pairedMinutesDelta: -75,
      pairedDurationCount: 2,
      rpeAverage: 6,
      rpeCount: 1,
      fatigueAverage: 8,
      fatigueCount: 1,
    });
    expect(r.recommendation.code).toBe("RECOVERY");
    expect((await summary()).fingerprint).toBe(r.fingerprint);
    await get("ai-coach/cycle-review/history").expect(200, { items: [] });
    expect(model.generate).not.toHaveBeenCalled();
    expect(await db.changeProposal.count({ where: { userId } })).toBe(before);
    expect(await db.aiGeneration.count({ where: { userId } })).toBe(0);
  });

  it("completes feedback → review → explicit generation → preview → validate → confirm → next plan and history", async () => {
    await post("activities")
      .send({
        workoutId: workoutIds[3],
        localDate: today,
        status: "COMPLETED",
        durationMin: 50,
        rpe: 4,
        fatigue: 3,
      })
      .expect(201);
    const body = await input("ADJUST");
    const clicks = await Promise.all([
      generate(body).expect(202),
      generate(body).expect(202),
    ]);
    expect(clicks[0].body.generationId).toBe(clicks[1].body.generationId);
    const job = await processJob(clicks[0].body.generationId);
    expect(job.status).toBe("READY");
    const id = job.proposalId!;
    const preview = (await get(`proposals/${id}`).expect(200)).body;
    expect(preview.cycleReview).toMatchObject({
      action: "ADJUST",
      snapshot: {
        fingerprint: body.review.fingerprint,
        stats: { completed: 2, unrecorded: 0 },
      },
    });
    expect(
      JSON.parse(model.generate.mock.calls[0][0].messages.at(-1).content)
        .cycleReview.snapshot.fingerprint,
    ).toBe(body.review.fingerprint);
    expect((await generate(body).expect(202)).body.proposalId).toBe(id);
    expect(
      (await db.planVersion.findUniqueOrThrow({ where: { id: versionId } }))
        .versionNo,
    ).toBe(1);
    await post(`proposals/${id}/validate`).expect(201);
    const apply = () =>
      post(`proposals/${id}/apply`)
        .set("Idempotency-Key", `cycle-apply-${id}`)
        .send({ expectedBaseVersion: 1, expectedProposalVersion: 1 });
    expect((await apply().expect(201)).body.newPlanVersion).toBe(2);
    expect((await apply().expect(201)).body.newPlanVersion).toBe(2);
    const after = await summary();
    expect(after.stats.planned).toBe(4);
    expect(after.stats.completed).toBe(2); // copies deduplicate
    const history = (await get("ai-coach/cycle-review/history").expect(200))
      .body.items;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      status: "APPLIED",
      appliedPlanVersion: 2,
      evidence: {
        action: "ADJUST",
        snapshot: { fingerprint: body.review.fingerprint },
      },
    });
    expect(await db.trainingActivity.count({ where: { userId } })).toBe(4);
  });

  it("rejects changed review evidence before submitting and while the model runs", async () => {
    const body = await input();
    await db.trainingActivity.create({
      data: {
        userId,
        localDate: new Date(today),
        status: "COMPLETED",
        fatigue: 2,
      },
    });
    expect((await generate(body).expect(409)).body.code).toBe(
      "CYCLE_REVIEW_STALE",
    );
    expect(await db.aiGeneration.count({ where: { userId } })).toBe(0);
    const job = (await generate(await input()).expect(202)).body;
    model.generate.mockImplementationOnce(async () => {
      await db.trainingActivity.create({
        data: {
          userId,
          localDate: new Date(today),
          status: "PARTIAL",
          notes: "生成期间新增反馈",
        },
      });
      return { text: JSON.stringify(output()), model: "cycle-test" };
    });
    expect(await processJob(job.generationId)).toMatchObject({
      status: "FAILED",
      errorCode: "CYCLE_REVIEW_STALE",
      proposalId: null,
    });
  });

  it("blocks stale feedback at validation/application and projects it into suggestion history", async () => {
    const id = await ready();
    await post(`proposals/${id}/validate`).expect(201);
    await db.trainingActivity.create({
      data: {
        userId,
        localDate: new Date(today),
        status: "SKIPPED",
        fatigue: 9,
      },
    });
    await post(`proposals/${id}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 1, expectedProposalVersion: 1 })
      .expect(409);
    const suggestions = (await get("ai-coach/suggestions").expect(200)).body;
    expect(suggestions.pending.some((p: { id: string }) => p.id === id)).toBe(
      false,
    );
    expect(
      suggestions.recent.find((p: { id: string }) => p.id === id),
    ).toMatchObject({
      status: "EXPIRED",
      staleReason: "周期复盘依据已变化，请刷新复盘并重新生成",
    });
    expect(
      (await post(`proposals/${id}/validate`).expect(201)).body,
    ).toMatchObject({ status: "BLOCKED" });
    expect(await db.planVersion.count({ where: { plan: { userId } } })).toBe(1);
  });

  it("validates recovery intensity at generation and after edits", async () => {
    model.generate.mockResolvedValueOnce({
      text: JSON.stringify(output(80)),
      model: "cycle-test",
    });
    const job = (await generate(await input("RECOVERY")).expect(202)).body;
    expect(await processJob(job.generationId)).toMatchObject({
      status: "FAILED",
      errorCode: "CYCLE_RECOVERY_INTENSITY",
      proposalId: null,
    });
    const id = await ready("RECOVERY");
    await request(app.getHttpServer())
      .patch(`/api/v1/ai-coach/proposals/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expectedProposalVersion: 1, draft: output(80) })
      .expect(200);
    expect(
      (await post(`proposals/${id}/validate`).expect(201)).body,
    ).toMatchObject({
      status: "BLOCKED",
      blockers: expect.arrayContaining([expect.stringContaining("70% FTP")]),
    });
  });

  it("preserves the previous usable draft when explicit regeneration fails", async () => {
    const id = await ready();
    const job = (
      await generate({ ...(await input()), forceRegenerate: true }).expect(202)
    ).body;
    model.generate.mockRejectedValueOnce(
      new AiException("AI_PROVIDER_INVALID_RESPONSE", "unavailable", false),
    );
    expect(await processJob(job.generationId)).toMatchObject({
      status: "FAILED",
    });
    expect((await get(`proposals/${id}`).expect(200)).body.status).toBe(
      "READY",
    );
    expect((await generate(await input()).expect(202)).body.proposalId).toBe(
      id,
    );
    const history = (await get("ai-coach/cycle-review/history").expect(200))
      .body.items;
    expect(history).toHaveLength(2);
    expect(history[0].evidence).toBeNull();
  });

  it("isolates another account's review, history, draft and generation job", async () => {
    const id = await ready();
    const job = await db.aiGeneration.findFirstOrThrow({
      where: { userId, proposalId: id },
    });
    const other = (
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
    users.push(other.user.id);
    const oldToken = token;
    token = other.tokens.accessToken;
    try {
      expect((await summary()).stats.planned).toBe(0);
      expect((await summary()).stats.completionRate).toBeNull();
      await get("ai-coach/cycle-review/history").expect(200, { items: [] });
      await get(`proposals/${id}`).expect(404);
      await get(`ai-coach/generations/${job.id}`).expect(404);
      await post(`proposals/${id}/apply`)
        .set("Idempotency-Key", randomUUID())
        .send({ expectedBaseVersion: 1, expectedProposalVersion: 1 })
        .expect(404);
    } finally {
      token = oldToken;
    }
  });

  it("creates the first official plan from an empty cycle only after explicit generation and confirmation", async () => {
    await db.trainingActivity.deleteMany({ where: { userId } });
    await db.trainingPlan.deleteMany({ where: { userId } });
    const r = await summary();
    expect(r.stats).toMatchObject({
      planned: 0,
      completionRate: null,
      actualMinutes: null,
    });
    expect(r.planVersion).toBe(0);
    expect(model.generate).not.toHaveBeenCalled();
    const job = (
      await generate({ ...(await input()), expectedBaseVersion: 0 }).expect(202)
    ).body;
    const generated = await processJob(job.generationId);
    expect(generated.status).toBe("READY");
    expect(await db.trainingPlan.count({ where: { userId } })).toBe(0);
    await post(`proposals/${generated.proposalId}/validate`).expect(201);
    const applied = await post(`proposals/${generated.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0, expectedProposalVersion: 1 })
      .expect(201);
    expect(applied.body.newPlanVersion).toBe(1);
    expect(
      await db.trainingPlan.count({ where: { userId, status: "ACTIVE" } }),
    ).toBe(1);
  });

  it("validates dates, ownership, scene restrictions, and never generates for missing basics", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/ai-coach/cycle-review")
      .expect(401);
    await get(`ai-coach/cycle-review?startDate=${today}`).expect(400);
    await get(
      `ai-coach/cycle-review?startDate=2026-02-30&endDate=${today}`,
    ).expect(400);
    await get(
      `ai-coach/cycle-review?startDate=${today}&endDate=${tomorrow}`,
    ).expect(400);
    await get(
      `ai-coach/cycle-review?startDate=${add(today, -84)}&endDate=${today}`,
    ).expect(400);
    const body = await input();
    await generate({ ...body, startDate: today }).expect(400);
    await generate({ ...body, endDate: add(today, 100) }).expect(400);
    await generate({ ...body, goalId: randomUUID() }).expect(404);
    await post("plans/generate-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        mode: "initial",
        goalId,
        weekStartDate: tomorrow,
        expectedBaseVersion: 1,
        cycleReview: body.review,
      })
      .expect(400);
    await db.abilityMeasurement.deleteMany({ where: { userId } });
    expect((await summary()).missingFields).toContain("ftp");
    expect((await generate(await input()).expect(400)).body.code).toBe(
      "FTP_REQUIRED",
    );
    expect(await db.aiGeneration.count({ where: { userId } })).toBe(0);
  });
});
