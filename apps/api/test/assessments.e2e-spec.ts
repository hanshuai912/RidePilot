import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import type {
  Assessment,
  AssessmentPatch,
  AssessmentSchedule,
} from "@ridepilot/contracts";
import { AiService } from "../src/ai/ai.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { CoachGenerationContextService } from "../src/modules/coach/coach-generation-context.service";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const day = (date: string, offset: number) =>
  new Date(Date.parse(date) + offset * 86400000).toISOString().slice(0, 10);
describeDb("stage assessments", () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let goalId: string;
  let today: string;
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
  const patch = (
    id: string,
    input: AssessmentPatch,
    key = randomUUID(),
    access = token,
  ) =>
    request(app.getHttpServer())
      .patch(`/api/v1/assessments/${id}`)
      .set("Authorization", `Bearer ${access}`)
      .set("Idempotency-Key", key)
      .send(input);
  const schedule = (
    extra: Partial<AssessmentSchedule> = {},
  ): AssessmentSchedule => ({
    goalId,
    localDate: today,
    kind: "FTP",
    protocol: "固定设备 FTP 方案",
    ...extra,
  });
  const create = async (
    extra: Partial<AssessmentSchedule> = {},
  ): Promise<Assessment> => {
    const input = schedule(extra);
    const preview = (
      await post("assessments/schedule-preview").send(input).expect(201)
    ).body;
    return (
      await post("assessments")
        .set("Idempotency-Key", randomUUID())
        .send({
          ...input,
          previewToken: preview.token,
          acknowledgeConflicts: true,
        })
        .expect(201)
    ).body;
  };
  const complete = (item: Assessment, extra: Partial<AssessmentPatch> = {}) =>
    patch(item.id, {
      expectedVersion: item.version,
      status: "COMPLETED",
      actualDate: today,
      protocol: item.protocol,
      resultWatts: 260,
      source: "TRAINER",
      rpe: 8,
      conditions: "室内，同一台骑行台",
      comparableConditions: true,
      ...extra,
    });
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
    await prisma.user.update({
      where: { id: userId },
      data: { timezone: "UTC" },
    });
    today = new Date().toISOString().slice(0, 10);
    goalId = (
      await post("goals")
        .send({
          type: "ENDURANCE",
          targetDate: day(today, 90),
          priority: "PRIMARY",
          description: "耐力目标",
        })
        .expect(201)
    ).body.id;
    await post("me/ability-measurements/ftp")
      .send({
        valueWatts: 250,
        source: "MANUAL",
        measuredAt: `${day(today, -7)}T00:00:00Z`,
      })
      .expect(201);
    await prisma.athleteProfile.upsert({
      where: { userId },
      create: { userId, experienceLevel: "INTERMEDIATE" },
      update: { experienceLevel: "INTERMEDIATE" },
    });
    await prisma.trainingAvailability.create({
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
    model.generate.mockReset();
  });
  afterAll(async () => {
    if (prisma) await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (app) await app.close();
  });

  test("authentication, ownership, FTP requirement and query validation", async () => {
    await request(app.getHttpServer()).get("/api/v1/assessments").expect(401);
    const item = await create();
    const other = await register();
    await get(`assessments/${item.id}`, other.tokens.accessToken).expect(404);
    await get(`assessments/${item.id}/review`, other.tokens.accessToken).expect(
      404,
    );
    await patch(
      item.id,
      { expectedVersion: 1, status: "SKIPPED", reason: "无时间" },
      randomUUID(),
      other.tokens.accessToken,
    ).expect(404);
    await post("assessments/schedule-preview", other.tokens.accessToken)
      .send(schedule())
      .expect(404);
    await get("assessments?from=2026-02-30").expect(400);
    await get("assessments?from=2020-01-01&to=2026-01-01").expect(400);
    await prisma.abilityMeasurement.deleteMany({ where: { userId } });
    await post("assessments/schedule-preview").send(schedule()).expect(400);
  });

  test("scheduling previews conflicts, rechecks changes and serializes uncertain retries", async () => {
    const input = schedule();
    const preview = (
      await post("assessments/schedule-preview").send(input).expect(201)
    ).body;
    await post("races")
      .send({
        name: "同日赛事",
        localDate: today,
        timezone: "UTC",
        distanceKm: 50,
        priority: "C",
      })
      .expect(201);
    await post("assessments")
      .set("Idempotency-Key", randomUUID())
      .send({
        ...input,
        previewToken: preview.token,
        acknowledgeConflicts: true,
      })
      .expect(409);
    const changed = (
      await post("assessments/schedule-preview").send(input).expect(201)
    ).body;
    expect(changed.conflicts[0]).toMatchObject({
      type: "RACE",
      title: "同日赛事",
    });
    const payload = {
      ...input,
      previewToken: changed.token,
      acknowledgeConflicts: false,
    };
    await post("assessments")
      .set("Idempotency-Key", randomUUID())
      .send(payload)
      .expect(409);
    const key = randomUUID();
    const [first, replay] = await Promise.all([
      post("assessments")
        .set("Idempotency-Key", key)
        .send({ ...payload, acknowledgeConflicts: true })
        .expect(201),
      post("assessments")
        .set("Idempotency-Key", key)
        .send({ ...payload, acknowledgeConflicts: true })
        .expect(201),
    ]);
    expect(first.body).toEqual(replay.body);
    expect(await prisma.trainingAssessment.count({ where: { userId } })).toBe(
      1,
    );
    await post("assessments")
      .set("Idempotency-Key", key)
      .send({ ...payload, acknowledgeConflicts: true, protocol: "变更方法" })
      .expect(409);
    expect(await prisma.trainingRace.count({ where: { userId } })).toBe(1);
  });

  test("saving valid FTP evidence never updates ability or courses; FTP confirmation is separate and idempotent", async () => {
    const item = await create();
    const result = (await complete(item).expect(200)).body;
    expect(result.actualDate).toBe(today);
    expect(
      (await get("me/ability-measurements/ftp").expect(200)).body.valueWatts,
    ).toBe(250);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    const review = (await get(`assessments/${item.id}/review`).expect(200))
      .body;
    expect(review).toMatchObject({
      canUpdateFtp: true,
      previous: null,
      comparison: null,
    });
    const input = { expectedVersion: 2, expectedFtpId: review.currentFtp.id };
    const key = randomUUID();
    const [applied, replay] = await Promise.all([
      post(`assessments/${item.id}/ftp-confirmation`)
        .set("Idempotency-Key", key)
        .send(input)
        .expect(201),
      post(`assessments/${item.id}/ftp-confirmation`)
        .set("Idempotency-Key", key)
        .send(input)
        .expect(201),
    ]);
    expect(applied.body).toEqual(replay.body);
    expect(applied.body.ftpMeasurementId).toBeTruthy();
    expect(
      (await get("me/ability-measurements/ftp").expect(200)).body,
    ).toMatchObject({ valueWatts: 260, source: "TEST" });
    expect(await prisma.abilityMeasurement.count({ where: { userId } })).toBe(
      2,
    );
    await post(`assessments/${item.id}/ftp-confirmation`)
      .set("Idempotency-Key", randomUUID())
      .send(input)
      .expect(409);
    await patch(item.id, {
      expectedVersion: 3,
      status: "INVALID",
      reason: "设备校准异常",
    }).expect(200);
    const invalid = (await get(`assessments/${item.id}/review`).expect(200))
      .body;
    expect(invalid).toMatchObject({
      canUpdateFtp: false,
      previous: null,
      assessment: { resultWatts: 260, reason: "设备校准异常" },
    });
    expect(invalid.messages.join(" ")).toContain("单独更正");
  });

  test("type-dependent fields and future actual date reject without losing the scheduled event", async () => {
    const item = await create();
    await complete(item, { source: null }).expect(400);
    await complete(item, { actualDate: day(today, 1) }).expect(400);
    await complete(item, { resultWatts: 900 }).expect(400);
    await patch(item.id, { expectedVersion: 1, status: "SKIPPED" }).expect(400);
    expect(
      (await get(`assessments/${item.id}`).expect(200)).body,
    ).toMatchObject({ status: "SCHEDULED", version: 1, resultWatts: null });
    const power = await create({ kind: "POWER_DURATION" });
    await complete(power, { resultWatts: 300 }).expect(400);
    await complete(power, { resultWatts: 300, durationSeconds: 1200 }).expect(
      200,
    );
    expect(
      (await get(`assessments/${power.id}/review`).expect(200)).body
        .canUpdateFtp,
    ).toBe(false);
    await post(`assessments/${power.id}/ftp-confirmation`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 2, expectedFtpId: null })
      .expect(409);
    const route = await create({ kind: "FIXED_ROUTE" });
    await complete(route, { resultWatts: null, durationSeconds: 1800 }).expect(
      400,
    );
    await complete(route, {
      resultWatts: null,
      durationSeconds: 1800,
      routeName: "固定爬坡段",
      distanceKm: 5,
    }).expect(200);
  });

  test("postponing moves the blocked date, keeps reasons and survives retry; incomplete/skipped/invalid do not require power", async () => {
    const original = day(today, 2),
      moved = day(today, 3);
    const item = await create({ localDate: original });
    const preview = (
      await post("assessments/schedule-preview")
        .send({ ...schedule({ localDate: moved }), excludeId: item.id })
        .expect(201)
    ).body;
    const payload: AssessmentPatch = {
      expectedVersion: 1,
      status: "POSTPONED",
      localDate: moved,
      reason: "疲劳，需要恢复",
      previewToken: preview.token,
      acknowledgeConflicts: true,
    };
    const key = randomUUID();
    const first = await patch(item.id, payload, key).expect(200);
    const replay = await patch(item.id, payload, key).expect(200);
    expect(first.body).toEqual(replay.body);
    await patch(item.id, {
      expectedVersion: 1,
      status: "SKIPPED",
      reason: "旧版本",
    }).expect(409);
    const context = await app.get(CoachGenerationContextService).load(
      userId,
      {
        goalId,
        weekStartDate: original,
        endDate: moved,
        mode: "range",
        expectedBaseVersion: 0,
      },
      "RANGE_PLAN",
    );
    expect(context.forbiddenDates).toContain(moved);
    expect(context.forbiddenDates).not.toContain(original);
    const plan = await prisma.trainingPlan.create({
      data: {
        userId,
        status: "ACTIVE",
        versions: {
          create: [
            {
              versionNo: 1,
              workouts: {
                create: {
                  sportType: "cycling",
                  scheduledDate: new Date(moved),
                  dayOrder: 1,
                  source: "manual",
                  title: "待恢复课程",
                  structure: {
                    segments: [
                      {
                        type: "work",
                        target: { kind: "duration", value: 30, unit: "min" },
                        intensity: { kind: "ftp_percent", min: 60, max: 70 },
                      },
                    ],
                  },
                },
              },
            },
            { versionNo: 2 },
          ],
        },
      },
      include: { versions: { orderBy: { versionNo: "asc" } } },
    });
    await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { activeVersionId: plan.versions[1].id },
    });
    const restore = await post(
      `plans/versions/${plan.versions[0].id}/restore-proposal`,
    )
      .send({ expectedBaseVersion: 2 })
      .expect(201);
    expect(restore.body.status).toBe("BLOCKED");
    expect(restore.body.blockers.join(" ")).toContain(
      `日期 ${moved} 已不可恢复`,
    );
    expect(
      (await get(`assessments?from=${moved}&to=${moved}`).expect(200)).body,
    ).toHaveLength(1);
    const incomplete = await patch(item.id, {
      expectedVersion: 2,
      status: "INCOMPLETE",
      reason: "无法完成",
      actualDate: today,
    }).expect(200);
    expect(incomplete.body).toMatchObject({
      reason: "无法完成",
      resultWatts: null,
      version: 3,
    });
    await patch(item.id, {
      expectedVersion: 3,
      status: "SKIPPED",
      reason: "停止此次测试",
    }).expect(200);
    const invalid = await create();
    await patch(invalid.id, {
      expectedVersion: 1,
      status: "INVALID",
      reason: "设备异常",
    }).expect(200);
    expect(
      (await get(`assessments/${invalid.id}/review`).expect(200)).body
        .canUpdateFtp,
    ).toBe(false);
  });

  test("review compares matching evidence only and counts stable workout records through copied versions", async () => {
    const secondary = (
      await post("goals")
        .send({
          type: "CUSTOM",
          description: "共享测试的次目标",
          priority: "SECONDARY",
          targetDate: day(today, 120),
        })
        .expect(201)
    ).body;
    const prior = await create({ goalId: secondary.id });
    await complete(prior, {
      actualDate: day(today, -2),
      resultWatts: 255,
    }).expect(200);
    const incompatible = await create({ protocol: "其他方案" });
    await complete(incompatible, {
      actualDate: day(today, -1),
      resultWatts: 290,
    }).expect(200);
    const latestFtp = (await get("me/ability-measurements/ftp").expect(200))
      .body;
    const stagePlan = await prisma.trainingStagePlan.create({
      data: {
        userId,
        goalId,
        goalsSnapshot: {
          goals: (await get("goals").expect(200)).body,
          tradeoffs: [],
        },
        goalVersion: 1,
        ftpMeasurementId: latestFtp.id,
        availabilityVersion: 1,
        profileVersion: 1,
        generationId: randomUUID(),
        status: "ACTIVE",
        summary: "基础阶段",
        startDate: new Date(day(today, -3)),
        endDate: new Date(today),
        model: "fixture",
        skillVersion: "1",
        stages: {
          create: {
            position: 0,
            title: "基础耐力",
            purpose: "复评",
            startDate: new Date(day(today, -3)),
            endDate: new Date(today),
            assessmentSuggestion: "同条件测试",
          },
        },
      },
      include: { stages: true },
    });
    const item = await create({ stageId: stagePlan.stages[0].id });
    const identity = randomUUID();
    const plan = await prisma.trainingPlan.create({
      data: {
        userId,
        status: "ACTIVE",
        versions: {
          create: {
            versionNo: 1,
            workouts: {
              create: [
                {
                  sportType: "CYCLING",
                  scheduledDate: new Date(day(today, -1)),
                  dayOrder: 1,
                  source: "MANUAL",
                  structure: { activityWorkoutId: identity },
                },
                {
                  sportType: "CYCLING",
                  scheduledDate: new Date(today),
                  dayOrder: 1,
                  source: "MANUAL",
                  structure: {},
                },
              ],
            },
          },
        },
      },
      include: { versions: true },
    });
    await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { activeVersionId: plan.versions[0].id },
    });
    await prisma.trainingActivity.create({
      data: {
        userId,
        workoutId: identity,
        localDate: new Date(day(today, -1)),
        status: "COMPLETED",
      },
    });
    await complete(item).expect(200);
    const review = (await get(`assessments/${item.id}/review`).expect(200))
      .body;
    expect(review.previous.id).toBe(prior.id);
    expect(review.comparison.wattsDelta).toBe(5);
    expect(review.training).toMatchObject({
      total: 2,
      completed: 1,
      unrecorded: 1,
    });
    const pending = await create({ stageId: stagePlan.stages[0].id });
    await prisma.trainingStagePlan.update({
      where: { id: stagePlan.id },
      data: { status: "ARCHIVED", version: { increment: 1 } },
    });
    const reschedule = (
      await post("assessments/schedule-preview")
        .send({
          ...schedule({ stageId: pending.stageId, localDate: day(today, 5) }),
          excludeId: pending.id,
        })
        .expect(201)
    ).body;
    await patch(pending.id, {
      expectedVersion: 1,
      status: "POSTPONED",
      localDate: day(today, 5),
      reason: "保留原阶段测试，稍后执行",
      previewToken: reschedule.token,
      acknowledgeConflicts: true,
    }).expect(200);
    const different = await create({ kind: "POWER_DURATION" });
    await complete(different, { durationSeconds: 600 }).expect(200);
    expect(
      (await get(`assessments/${different.id}/review`).expect(200)).body
        .previous,
    ).toBeNull();
    const uncertain = await create();
    await complete(uncertain, { comparableConditions: false }).expect(200);
    expect(
      (await get(`assessments/${uncertain.id}/review`).expect(200)).body
        .previous,
    ).toBeNull();
  });

  test("historical test cannot replace a newer FTP and concurrent FTP changes invalidate confirmation", async () => {
    const item = await create();
    await complete(item, { actualDate: day(today, -2) }).expect(200);
    const old = (await get(`assessments/${item.id}/review`).expect(200)).body;
    await post("me/ability-measurements/ftp")
      .send({
        valueWatts: 270,
        source: "MANUAL",
        measuredAt: new Date().toISOString(),
      })
      .expect(201);
    await post(`assessments/${item.id}/ftp-confirmation`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 2, expectedFtpId: old.currentFtp.id })
      .expect(409);
    const refreshed = (await get(`assessments/${item.id}/review`).expect(200))
      .body;
    expect(refreshed.canUpdateFtp).toBe(false);
    await post(`assessments/${item.id}/ftp-confirmation`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 2, expectedFtpId: refreshed.currentFtp.id })
      .expect(409);
    expect(
      (await get("me/ability-measurements/ftp").expect(200)).body.valueWatts,
    ).toBe(270);
  });

  test("subsequent range drafts carry review evidence and become blocked if the result changes", async () => {
    const item = await create();
    await complete(item).expect(200);
    const start = day(today, 2),
      end = start;
    model.generate.mockResolvedValue({
      text: JSON.stringify({
        summary: "复评后耐力训练",
        stageSummary: "保留基础训练",
        assessmentSuggestion: "后续同条件复评",
        workouts: [
          {
            scheduledDate: start,
            title: "耐力骑行",
            purpose: "耐力",
            segments: [
              {
                type: "work",
                target: { kind: "duration", value: 30, unit: "min" },
                intensity: { kind: "ftp_percent", min: 60, max: 70 },
              },
            ],
          },
        ],
      }),
      model: "mock",
      requestId: randomUUID(),
    });
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "DATES",
          goalId,
          startDate: start,
          endDate: end,
          assessmentId: item.id,
          assessmentVersion: 2,
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    let finished;
    for (let i = 0; i < 60; i++) {
      finished = (
        await get(`ai-coach/generations/${job.generationId}`).expect(200)
      ).body;
      if (["READY", "FAILED"].includes(finished.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(finished).toMatchObject({ status: "READY", errorCode: null });
    expect(JSON.stringify(model.generate.mock.calls)).toContain(
      "reviewEvidence",
    );
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    await patch(item.id, {
      expectedVersion: 2,
      status: "INVALID",
      reason: "复核设备有误",
    }).expect(200);
    const validation = await post(
      `proposals/${finished.proposalId}/validate`,
    ).expect(201);
    expect(validation.body.blockers.join(" ")).toContain("测试已变化");
    await post(`proposals/${finished.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0 })
      .expect(409);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
  });
});
