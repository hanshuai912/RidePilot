import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import { AiService } from "../src/ai/ai.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase("AI coach weekly plan API", () => {
  jest.setTimeout(30_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const userIds: string[] = [];
  const model = { generate: jest.fn() };

  const monday = () => {
    const now = new Date();
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7) + 7);
    return date.toISOString().slice(0, 10);
  };
  const get = (path: string, accessToken = token) =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${accessToken}`);
  const post = (path: string, accessToken = token) =>
    request(app.getHttpServer())
      .post(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${accessToken}`);
  const waitForGeneration = async (id: string) => {
    let job = (await get(`ai-coach/generations/${id}`).expect(200)).body;
    for (
      let i = 0;
      i < 30 && job.status !== "READY" && job.status !== "FAILED";
      i++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      job = (await get(`ai-coach/generations/${id}`).expect(200)).body;
    }
    return job;
  };

  const register = async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        phone: `19${randomInt(100_000_000, 1_000_000_000)}`,
        verificationCode: "123456",
        password: "Ab!123",
        confirmPassword: "Ab!123",
      })
      .expect(201);
    userIds.push(response.body.user.id);
    await prisma.user.update({
      where: { id: response.body.user.id },
      data: { timezone: "Asia/Shanghai" },
    });
    await prisma.athleteProfile.upsert({
      where: { userId: response.body.user.id },
      create: {
        userId: response.body.user.id,
        experienceLevel: "INTERMEDIATE",
      },
      update: { experienceLevel: "INTERMEDIATE" },
    });
    return response.body;
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
    userId = auth.user.id;
    token = auth.tokens.accessToken;
    model.generate.mockReset();
    model.generate.mockImplementation(async () => ({
      text: JSON.stringify({
        summary: "一周耐力计划",
        stageSummary: "基础阶段",
        assessmentSuggestion: "阶段结束复评",
        workouts: [
          {
            scheduledDate: monday(),
            title: "耐力骑行",
            purpose: "提高耐力",
            segments: [
              {
                type: "warmup",
                target: { kind: "duration", value: 10, unit: "min" },
                intensity: { kind: "ftp_percent", min: 45, max: 55 },
              },
              {
                type: "work",
                target: { kind: "duration", value: 40, unit: "min" },
                intensity: { kind: "ftp_percent", min: 60, max: 75 },
              },
              {
                type: "cooldown",
                target: { kind: "duration", value: 10, unit: "min" },
                intensity: { kind: "ftp_percent", min: 40, max: 50 },
              },
            ],
          },
        ],
      }),
      requestId: randomUUID(),
      model: "mock-coach",
    }));
  });
  afterAll(async () => {
    if (prisma && userIds.length) {
      await prisma.trainingPlan.updateMany({
        where: { userId: { in: userIds } },
        data: { activeVersionId: null },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app?.close();
  });

  it("single and weekly adjustments preserve all courses outside their exact editable scope", async () => {
    const addDays = (date: string, days: number) =>
      new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86400000)
        .toISOString()
        .slice(0, 10);
    const addCourse = async (date: string, title: string, base: number) => {
      const draft = await post("workouts/manual-proposals")
        .send({
          scheduledDate: date,
          title,
          segments: [
            {
              type: "work",
              target: { kind: "duration", value: 20, unit: "min" },
              intensity: { kind: "power_watt", min: 100, max: 130 },
            },
          ],
        })
        .expect(201);
      await post(`proposals/${draft.body.proposalId}/validate`).expect(201);
      await post(`proposals/${draft.body.proposalId}/apply`)
        .set("Idempotency-Key", randomUUID())
        .send({ expectedBaseVersion: base })
        .expect(201);
    };
    const calendar = async () =>
      (
        await get(
          `calendar?from=${monday()}&to=${addDays(monday(), 13)}`,
        ).expect(200)
      ).body.items as {
        id: string;
        title: string;
        scheduledDate: string;
        dayOrder: number;
        segments: unknown;
        activity: unknown;
      }[];
    await post("me/ability-measurements/ftp")
      .send({
        valueWatts: 193,
        measuredAt: new Date().toISOString(),
        source: "MANUAL",
      })
      .expect(201);
    await addCourse(monday(), "目标课程", 0);
    await addCourse(monday(), "同日保留课程", 1);
    await addCourse(addDays(monday(), 7), "下周保留课程", 2);
    await post("me/ability-measurements/ftp")
      .send({
        valueWatts: 193,
        measuredAt: new Date().toISOString(),
        source: "MANUAL",
      })
      .expect(201);
    await request(app.getHttpServer())
      .put("/api/v1/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "Asia/Shanghai",
        weekdays: [{ weekday: 1, availableMinutes: 90 }],
        maxSessionMinutes: 90,
      })
      .expect(200);
    const goal = await post("goals")
      .send({
        type: "ENDURANCE",
        targetDate: "2030-12-31",
        priority: "PRIMARY",
      })
      .expect(201);
    const before = await calendar();
    const target = before.find((item) => item.title === "目标课程")!;
    const pending = await post(`workouts/${target.id}/ai-adjust-proposal`)
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "replace_workout",
        expectedBaseVersion: 3,
      })
      .expect(202);
    const job = await waitForGeneration(pending.body.generationId);
    expect(job.status).toBe("READY");
    expect(
      (await get(`proposals/${job.proposalId}`).expect(200)).body
        .replaceWorkoutIds,
    ).toEqual([target.id]);
    expect(await calendar()).toEqual(before);
    await post(`proposals/${job.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 3 })
      .expect(201);
    const after = await calendar();
    expect(after).toHaveLength(3);
    expect(after.find((item) => item.title === "耐力骑行")?.dayOrder).toBe(
      target.dayOrder,
    );
    for (const retained of before.filter((item) => item.id !== target.id))
      expect(after.find((item) => item.title === retained.title)).toMatchObject(
        {
          scheduledDate: retained.scheduledDate,
          dayOrder: retained.dayOrder,
          segments: retained.segments,
        },
      );
    const recorded = after.find((item) => item.title === "同日保留课程")!;
    await post("activities")
      .send({
        workoutId: recorded.id,
        localDate: recorded.scheduledDate,
        status: "PARTIAL",
        durationMin: 10,
      })
      .expect(201);
    const weekly = await post("plans/adjust-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "replace_week",
        expectedBaseVersion: 4,
      })
      .expect(202);
    const weekJob = await waitForGeneration(weekly.body.generationId);
    expect(weekJob.status).toBe("READY");
    const proposal = (await get(`proposals/${weekJob.proposalId}`).expect(200))
      .body;
    expect(proposal.replaceWorkoutIds).toEqual([
      after.find((item) => item.title === "耐力骑行")!.id,
    ]);
    await post(`proposals/${weekJob.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 4 })
      .expect(201);
    const final = await calendar();
    expect(final).toHaveLength(3);
    expect(final.find((item) => item.title === "同日保留课程")).toMatchObject({
      activity: { status: "PARTIAL", durationMin: 10 },
    });
    expect(final.find((item) => item.title === "下周保留课程")).toMatchObject({
      scheduledDate: addDays(monday(), 7),
      segments: before[2].segments,
    });
  });

  it("rejects missing FTP before invoking the model", async () => {
    const response = await post("plans/generate-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: randomUUID(),
        mode: "initial",
        expectedBaseVersion: 0,
      })
      .expect(400);
    expect(response.body.code).toBe("FTP_REQUIRED");
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("requires weight and calculates a structured 4 W/kg FTP goal", async () => {
    await post("me/ability-measurements/ftp")
      .send({
        valueWatts: 193,
        measuredAt: new Date().toISOString(),
        source: "MANUAL",
      })
      .expect(201);
    await request(app.getHttpServer())
      .put("/api/v1/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "Asia/Shanghai",
        weekdays: [{ weekday: 1, availableMinutes: 90 }],
        maxSessionMinutes: 90,
      })
      .expect(200);
    const goal = await post("goals")
      .send({
        type: "FTP",
        targetWkg: 4,
        targetDate: "2030-12-31",
        priority: "PRIMARY",
      })
      .expect(201);
    expect(goal.body.targetWkg).toBe(4);
    expect(
      (await get("ai-coach/readiness").expect(200)).body.missingFields,
    ).toContain("weightKg");
    const profile = await get("me/profile").expect(200);
    await post("me/profile")
      .send({
        expectedVersion: profile.body.version,
        heightCm: 170,
        weightKg: 55,
      })
      .expect(200);
    expect((await get("ai-coach/readiness").expect(200)).body.ready).toBe(true);
    const submitted = await post("plans/generate-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "initial",
        expectedBaseVersion: 0,
      })
      .expect(202);
    expect((await waitForGeneration(submitted.body.generationId)).status).toBe(
      "READY",
    );
    const userMessage = model.generate.mock.calls[0][0].messages.find(
      (message: { role: string }) => message.role === "user",
    ).content as string;
    const context = JSON.parse(userMessage) as {
      goal: { targetFtpWatts: number; targetWkg: number };
      bodyMetrics: { heightCm: number; weightKg: number };
      currentFtpWkg: number;
    };
    expect(context.goal).toMatchObject({ targetWkg: 4, targetFtpWatts: 220 });
    expect(context.bodyMetrics).toEqual({ heightCm: 170, weightKg: 55 });
    expect(context.currentFtpWkg).toBe(3.51);
  });

  it("generates a reviewed weekly draft and publishes it exactly once", async () => {
    await post("me/ability-measurements/ftp")
      .send({
        valueWatts: 250,
        measuredAt: new Date().toISOString(),
        source: "MANUAL",
      })
      .expect(201);
    await request(app.getHttpServer())
      .put("/api/v1/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "Asia/Shanghai",
        weekdays: [{ weekday: 1, availableMinutes: 90 }],
        maxSessionMinutes: 90,
      })
      .expect(200);
    const goal = await post("goals")
      .send({
        type: "ENDURANCE",
        targetDate: "2030-12-31",
        priority: "PRIMARY",
      })
      .expect(201);
    expect((await get("ai-coach/readiness").expect(200)).body.ready).toBe(true);
    model.generate.mockImplementationOnce(async () => ({
      text: "invalid JSON",
      requestId: randomUUID(),
      model: "mock-coach",
    }));
    const key = randomUUID();
    const created = await post("plans/generate-proposal")
      .set("Idempotency-Key", key)
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "initial",
        expectedBaseVersion: 0,
      })
      .expect(202);
    const duplicate = await post("plans/generate-proposal")
      .set("Idempotency-Key", key)
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "initial",
        expectedBaseVersion: 0,
      })
      .expect(202);
    expect(duplicate.body.generationId).toBe(created.body.generationId);
    const job = await waitForGeneration(created.body.generationId);
    expect(job).toMatchObject({ status: "READY", errorCode: null });
    expect(model.generate).toHaveBeenCalledTimes(2);
    const proposal = (await get(`proposals/${job.proposalId}`).expect(200))
      .body;
    expect(proposal).toMatchObject({
      status: "READY",
      basePlanVersion: 0,
      workouts: [{ title: "耐力骑行" }],
    });
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    const other = await register();
    await get(
      `ai-coach/generations/${job.generationId}`,
      other.tokens.accessToken,
    ).expect(404);
    await get(`proposals/${job.proposalId}`, other.tokens.accessToken).expect(
      404,
    );
    const apply = () =>
      post(`proposals/${job.proposalId}/apply`)
        .set("Idempotency-Key", "apply-week-1")
        .send({ expectedBaseVersion: 0 });
    const first = await apply().expect(201);
    const repeated = await apply().expect(201);
    expect(repeated.body).toEqual(first.body);
    expect(first.body.newPlanVersion).toBe(1);
    const calendar = await get(
      `calendar?from=${monday()}&to=${monday()}`,
    ).expect(200);
    expect(calendar.body.items).toMatchObject([
      { title: "耐力骑行", source: "ai", planVersion: 1 },
    ]);
    const chat = await post("ai-coach/chat")
      .send({ message: "为什么本周安排耐力骑行？" })
      .expect(201);
    expect(chat.body).toMatchObject({ readOnly: true, model: "mock-coach" });

    const workoutId = calendar.body.items[0].id;
    const weekAdjustment = await post("plans/adjust-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "replace_week",
        expectedBaseVersion: 1,
      })
      .expect(202);
    const weekJob = await waitForGeneration(weekAdjustment.body.generationId);
    expect(weekJob.status).toBe("READY");
    expect(
      (await get(`proposals/${weekJob.proposalId}`).expect(200)).body,
    ).toMatchObject({
      scene: "PLAN_ADJUST",
      replaceWorkoutIds: [workoutId],
    });
    const adjustment = await post(`workouts/${workoutId}/ai-adjust-proposal`)
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "replace_workout",
        reason: "TIME_SHORT",
        expectedBaseVersion: 1,
      })
      .expect(202);
    const adjustmentJob = await waitForGeneration(adjustment.body.generationId);
    expect(adjustmentJob.status).toBe("READY");
    const adjustmentProposal = (
      await get(`proposals/${adjustmentJob.proposalId}`).expect(200)
    ).body;
    expect(adjustmentProposal).toMatchObject({
      scene: "WORKOUT_ADJUST",
      replaceWorkoutIds: [workoutId],
    });
    await post(`proposals/${adjustmentJob.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 1 })
      .expect(201);
    const adjustedCalendar = await get(
      `calendar?from=${monday()}&to=${monday()}`,
    ).expect(200);
    expect(adjustedCalendar.body.items).toHaveLength(1);
    expect(adjustedCalendar.body.items[0].planVersion).toBe(2);

    const assessment = await post("assessments")
      .send({
        goalId: goal.body.id,
        localDate: new Date().toISOString().slice(0, 10),
        protocol: "FTP_TEST",
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/assessments/${assessment.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        expectedVersion: 1,
        status: "COMPLETED",
        resultWatts: 255,
        conditions: "室内骑行台",
      })
      .expect(200);
    const review = await post(
      `assessments/${assessment.body.id}/review-proposal`,
    )
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "replace_week",
        expectedBaseVersion: 2,
      })
      .expect(202);
    const reviewJob = await waitForGeneration(review.body.generationId);
    expect(reviewJob.status).toBe("READY");
    await post(`proposals/${reviewJob.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 2 })
      .expect(201);

    const raceDay = new Date(
      Date.parse(`${monday()}T00:00:00.000Z`) + 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const race = await post("races")
      .send({
        name: "测试赛",
        localDate: raceDay,
        timezone: "Asia/Shanghai",
        distanceKm: 100,
        priority: "A",
      })
      .expect(201);
    const replan = await post(`races/${race.body.id}/replan-proposal`)
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "replace_week",
        expectedBaseVersion: 3,
      })
      .expect(202);
    const raceJob = await waitForGeneration(replan.body.generationId);
    expect(raceJob.status).toBe("READY");
    await post(`proposals/${raceJob.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 3 })
      .expect(201);
    const finalCalendar = await get(
      `calendar?from=${monday()}&to=${monday()}`,
    ).expect(200);
    expect(finalCalendar.body.items).toHaveLength(1);
    const versions = await get("plans/versions").expect(200);
    const firstVersion = versions.body.find(
      (item: { versionNo: number }) => item.versionNo === 1,
    );
    expect(firstVersion).toBeDefined();
    const restoration = await post(
      `plans/versions/${firstVersion.id}/restore-proposal`,
    )
      .send({ expectedBaseVersion: 4 })
      .expect(201);
    expect(restoration.body).toMatchObject({
      status: "READY",
      targetPlanVersion: 1,
    });
    const restored = await post(
      `proposals/${restoration.body.proposalId}/apply`,
    )
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 4 })
      .expect(201);
    expect(restored.body.newPlanVersion).toBe(5);
    const restoredCalendar = await get(
      `calendar?from=${monday()}&to=${monday()}`,
    ).expect(200);
    expect(restoredCalendar.body.items).toHaveLength(1);
    expect(restoredCalendar.body.items[0].planVersion).toBe(5);
    await post("activities")
      .send({
        workoutId: restoredCalendar.body.items[0].id,
        localDate: monday(),
        status: "PARTIAL",
        durationMin: 35,
        rpe: 7,
        fatigue: 6,
      })
      .expect(201);
    await post(
      `workouts/${restoredCalendar.body.items[0].id}/ai-adjust-proposal`,
    )
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate: monday(),
        goalId: goal.body.id,
        mode: "replace_workout",
        reason: "MISSED",
        expectedBaseVersion: 5,
      })
      .expect(409);
  });
});
