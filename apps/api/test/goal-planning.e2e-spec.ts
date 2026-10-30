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
describeDb("goal stages and selected course ranges", () => {
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
  const generateStages = async () => {
    const job = (
      await post("stage-plans/generate-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({ goalId, startDate: start, endDate: addDays(start, 13) })
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
  const manual = async (date: string, title: string, version: number) => {
    const draft = (
      await post("workouts/manual-proposals")
        .send(workout(date, title))
        .expect(201)
    ).body;
    await post(`proposals/${draft.proposalId}/validate`).expect(201);
    await post(`proposals/${draft.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: version })
      .expect(201);
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
          targetDate: addDays(start, 180),
          priority: "PRIMARY",
        })
        .expect(201)
    ).body.id;
    model.generate.mockReset();
    model.generate.mockImplementation(
      async (input: { messages: { content: string }[] }) => {
        const payload = JSON.parse(input.messages.at(-1)!.content);
        if (payload.task === "生成训练目标的阶段安排草稿")
          return {
            text: JSON.stringify({
              summary: "两阶段耐力训练",
              stages: [
                {
                  title: "基础",
                  purpose: "耐力",
                  startDate: payload.input.startDate,
                  endDate: addDays(payload.input.startDate, 6),
                  assessmentSuggestion: "主观反馈",
                },
                {
                  title: "巩固",
                  purpose: "恢复与巩固",
                  startDate: addDays(payload.input.startDate, 7),
                  endDate: payload.input.endDate,
                  assessmentSuggestion: "阶段复评",
                },
              ],
            }),
            model: "mock-stage",
          };
        const dates = payload.allowedDates as string[];
        const seen = new Set<string>();
        const selected = dates.filter((date) => {
          const day = new Date(date);
          const week = addDays(date, -((day.getUTCDay() + 6) % 7));
          if (seen.has(week)) return false;
          seen.add(week);
          return true;
        });
        return {
          text: JSON.stringify({
            summary: "范围课程",
            stageSummary: "耐力",
            assessmentSuggestion: "复评",
            workouts: selected.map((date) => workout(date)),
          }),
          model: "mock-range",
        };
      },
    );
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

  it("blocks missing FTP for manual watts, stages and range generation before calling AI", async () => {
    await prisma.abilityMeasurement.deleteMany({ where: { userId } });
    const body = workout(start);
    body.segments[0].intensity = { kind: "power_watt", min: 100, max: 150 };
    expect(
      (await post("workouts/manual-proposals").send(body).expect(400)).body
        .code,
    ).toBe("FTP_REQUIRED");
    expect(
      (
        await post("stage-plans/generate-proposal")
          .set("Idempotency-Key", randomUUID())
          .send({ goalId, startDate: start, endDate: addDays(start, 13) })
          .expect(400)
      ).body.code,
    ).toBe("FTP_REQUIRED");
    expect(
      (
        await post("plans/generate-range-proposal")
          .set("Idempotency-Key", randomUUID())
          .send({
            scope: "DATES",
            goalId,
            startDate: start,
            endDate: addDays(start, 13),
            expectedBaseVersion: 0,
          })
          .expect(400)
      ).body.code,
    ).toBe("FTP_REQUIRED");
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("keeps stages as draft until confirmation, isolates users, activates once and supports selected-stage courses", async () => {
    const draft = await generateStages();
    expect(draft.status).toBe("DRAFT");
    expect(
      (await get(`goals/${goalId}/stage-plan`).expect(200)).body.plan,
    ).toBeNull();
    const other = await register();
    await get(`stage-plans/${draft.id}`, other.tokens.accessToken).expect(404);
    await post(`stage-plans/${draft.id}/activate`, other.tokens.accessToken)
      .send({ expectedVersion: 1 })
      .expect(404);
    const active = (
      await post(`stage-plans/${draft.id}/activate`)
        .send({ expectedVersion: 1 })
        .expect(201)
    ).body;
    expect(
      (
        await post(`stage-plans/${draft.id}/activate`)
          .send({ expectedVersion: 1 })
          .expect(201)
      ).body.version,
    ).toBe(2);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "STAGE",
          goalId,
          stageId: active.stages[0].id,
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("READY");
    const proposal = (await get(`proposals/${finished.proposalId}`).expect(200))
      .body;
    expect(proposal).toMatchObject({
      scene: "RANGE_PLAN",
      weekStartDate: start,
      endDate: addDays(start, 6),
      stageId: active.stages[0].id,
    });
    const modelInput = JSON.parse(
      model.generate.mock.calls.at(-1)![0].messages.at(-1).content,
    );
    expect(modelInput.stage).toMatchObject({ title: "基础", purpose: "耐力" });
    const replacement = await generateStages();
    await post(`stage-plans/${replacement.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(201);
    const validation = (
      await post(`proposals/${proposal.proposalId}/validate`).expect(201)
    ).body;
    expect(validation.status).toBe("BLOCKED");
    expect(validation.blockers.join(" ")).toContain("阶段安排已变化");
  });

  it("rejects stale stage activation and stale stage course generation after FTP changes", async () => {
    const draft = await generateStages();
    await ftp();
    await post(`stage-plans/${draft.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(409);
    const fresh = await generateStages();
    const active = (
      await post(`stage-plans/${fresh.id}/activate`)
        .send({ expectedVersion: 1 })
        .expect(201)
    ).body;
    await ftp();
    await post("plans/generate-range-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        scope: "STAGE",
        goalId,
        stageId: active.stages[0].id,
        expectedBaseVersion: 0,
      })
      .expect(409);
    expect(
      (await get(`goals/${goalId}/stage-plan`).expect(200)).body.plan.stale,
    ).toBe(true);
  });

  it("rejects concurrent stage drafts and requires authentication and owned stages", async () => {
    const first = await generateStages();
    const second = await generateStages();
    await post(`stage-plans/${first.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(201);
    expect(
      (
        await post(`stage-plans/${second.id}/activate`)
          .send({ expectedVersion: 1 })
          .expect(409)
      ).body.code,
    ).toBe("STAGE_PLAN_STALE");
    expect(
      (await get(`goals/${goalId}/stage-plan`).expect(200)).body.plan.id,
    ).toBe(first.id);
    const other = await register();
    await post("plans/generate-range-proposal", other.tokens.accessToken)
      .set("Idempotency-Key", randomUUID())
      .send({
        scope: "STAGE",
        goalId,
        stageId: first.stages[0].id,
        expectedBaseVersion: 0,
      })
      .expect(404);
    await request(app.getHttpServer())
      .post("/api/v1/stage-plans/generate-proposal")
      .send({ goalId, startDate: start, endDate: addDays(start, 13) })
      .expect(401);
    await post("plans/generate-range-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        scope: "DATES",
        goalId,
        startDate: start,
        endDate: addDays(start, 13),
        expectedBaseVersion: 99,
      })
      .expect(409);
  });

  it("keeps the current stage plan and workouts unchanged when AI returns invalid stages", async () => {
    const first = await generateStages();
    await post(`stage-plans/${first.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(201);
    model.generate.mockResolvedValue({
      text: JSON.stringify({
        summary: "缺少首日",
        stages: [
          {
            title: "错误阶段",
            purpose: "无效",
            startDate: addDays(start, 1),
            endDate: addDays(start, 13),
            assessmentSuggestion: "复评",
          },
        ],
      }),
      model: "mock-invalid",
    });
    const job = (
      await post("stage-plans/generate-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({ goalId, startDate: start, endDate: addDays(start, 13) })
        .expect(202)
    ).body;
    expect((await wait(job.generationId)).status).toBe("FAILED");
    expect(
      (await get(`goals/${goalId}/stage-plan`).expect(200)).body.plan.id,
    ).toBe(first.id);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
  });

  it("replaces only future unrecorded courses in an arbitrary range and publishes exactly once", async () => {
    await manual(addDays(start, 2), "待替换", 0);
    await manual(addDays(start, 3), "已记录", 1);
    await manual(addDays(start, 15), "范围外", 2);
    const before = (
      await get(`calendar?from=${start}&to=${addDays(start, 20)}`).expect(200)
    ).body.items;
    const recorded = before.find(
      (w: { title: string }) => w.title === "已记录",
    );
    await post("activities")
      .send({
        workoutId: recorded.id,
        localDate: recorded.scheduledDate,
        status: "COMPLETED",
        durationMin: 30,
        rpe: 4,
        fatigue: 2,
        notes: "保留结果",
      })
      .expect(201);
    const input = {
      scope: "DATES",
      goalId,
      startDate: addDays(start, 1),
      endDate: addDays(start, 10),
      expectedBaseVersion: 3,
    };
    const key = randomUUID();
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", key)
        .send(input)
        .expect(202)
    ).body;
    expect(
      (
        await post("plans/generate-range-proposal")
          .set("Idempotency-Key", key)
          .send(input)
          .expect(202)
      ).body.generationId,
    ).toBe(job.generationId);
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("READY");
    const proposal = (await get(`proposals/${finished.proposalId}`).expect(200))
      .body;
    expect(proposal.replaceWorkoutIds).toEqual([
      before.find((w: { title: string }) => w.title === "待替换").id,
    ]);
    await post(`proposals/${proposal.proposalId}/validate`).expect(201);
    const applied = (
      await post(`proposals/${proposal.proposalId}/apply`)
        .set("Idempotency-Key", randomUUID())
        .send({ expectedBaseVersion: 3 })
        .expect(201)
    ).body;
    expect(applied.affectedDates).toContain(addDays(start, 2));
    expect(
      (
        await post(`proposals/${proposal.proposalId}/apply`)
          .set("Idempotency-Key", randomUUID())
          .send({ expectedBaseVersion: 3 })
          .expect(201)
      ).body.newPlanVersion,
    ).toBe(4);
    const after = (
      await get(`calendar?from=${start}&to=${addDays(start, 20)}`).expect(200)
    ).body.items;
    expect(
      after.find((w: { title: string }) => w.title === "待替换"),
    ).toBeUndefined();
    expect(
      after.find((w: { title: string }) => w.title === "已记录").activity,
    ).toMatchObject({ status: "COMPLETED", durationMin: 30 });
    expect(
      after.find((w: { title: string }) => w.title === "范围外").segments,
    ).toEqual(
      before.find((w: { title: string }) => w.title === "范围外").segments,
    );
  });
});
