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

  it.each([false, true])(
    "race draft can fill an empty week (existing plan: %s), with explicit atomic apply",
    async (existingPlan) => {
      const start = monday();
      const outside = new Date(Date.parse(`${start}T00:00:00Z`) + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      await post("me/ability-measurements/ftp")
        .send({
          valueWatts: 200,
          measuredAt: new Date().toISOString(),
          source: "MANUAL",
        })
        .expect(201);
      if (existingPlan) {
        const manual = await post("workouts/manual-proposals")
          .send({
            scheduledDate: outside,
            title: "范围外保留课程",
            segments: [
              {
                type: "work",
                target: { kind: "duration", value: 20, unit: "min" },
                intensity: { kind: "power_watt", min: 100, max: 130 },
              },
            ],
          })
          .expect(201);
        await post(`proposals/${manual.body.proposalId}/validate`).expect(201);
        await post(`proposals/${manual.body.proposalId}/apply`)
          .set("Idempotency-Key", randomUUID())
          .send({ expectedBaseVersion: 0 })
          .expect(201);
      }
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
        .send({ type: "RACE", targetDate: "2030-12-31", priority: "PRIMARY" })
        .expect(201);
      const raceDay = new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 86400000)
        .toISOString()
        .slice(0, 10);
      const race = await post("races")
        .send({
          name: "备赛空白周测试",
          localDate: raceDay,
          timezone: "Asia/Shanghai",
          distanceKm: 100,
          priority: "A",
        })
        .expect(201);
      const base = existingPlan ? 1 : 0;
      const input = {
        weekStartDate: start,
        goalId: goal.body.id,
        mode: "replace_week",
        expectedBaseVersion: base,
      };
      const generationKey = randomUUID();
      const draft = await post(`races/${race.body.id}/replan-proposal`)
        .set("Idempotency-Key", generationKey)
        .send(input)
        .expect(202);
      const duplicate = await post(`races/${race.body.id}/replan-proposal`)
        .set("Idempotency-Key", generationKey)
        .send(input)
        .expect(202);
      expect(duplicate.body.generationId).toBe(draft.body.generationId);
      const job = await waitForGeneration(draft.body.generationId);
      expect(job.status).toBe("READY");
      const preview = await get(`proposals/${job.proposalId}`).expect(200);
      expect(preview.body).toMatchObject({
        scene: "RACE_REPLAN",
        basePlanVersion: base,
        replaceWorkoutIds: [],
      });
      const before = await get(`calendar?from=${start}&to=${outside}`).expect(
        200,
      );
      expect(before.body.items).toHaveLength(existingPlan ? 1 : 0);
      await post(`proposals/${job.proposalId}/apply`)
        .set("Idempotency-Key", randomUUID())
        .send({ expectedBaseVersion: base + 1 })
        .expect(409);
      const applyKey = randomUUID();
      const applied = await post(`proposals/${job.proposalId}/apply`)
        .set("Idempotency-Key", applyKey)
        .send({ expectedBaseVersion: base })
        .expect(201);
      expect(applied.body.newPlanVersion).toBe(base + 1);
      const replay = await post(`proposals/${job.proposalId}/apply`)
        .set("Idempotency-Key", applyKey)
        .send({ expectedBaseVersion: base })
        .expect(201);
      expect(replay.body.newPlanVersion).toBe(base + 1);
      const calendar = await get(`calendar?from=${start}&to=${outside}`).expect(
        200,
      );
      expect(calendar.body.items).toHaveLength(existingPlan ? 2 : 1);
      if (existingPlan)
        expect(calendar.body.items).toContainEqual(
          expect.objectContaining({
            title: "范围外保留课程",
            scheduledDate: outside,
          }),
        );
    },
  );

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

    const assessmentInput = {
      goalId: goal.body.id,
      localDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
      }).format(new Date()),
      protocol: "FTP_TEST",
      kind: "FTP",
    };
    const assessmentPreview = await post("assessments/schedule-preview")
      .send(assessmentInput)
      .expect(201);
    const assessment = await post("assessments")
      .set("Idempotency-Key", randomUUID())
      .send({
        ...assessmentInput,
        previewToken: assessmentPreview.body.token,
        acknowledgeConflicts: true,
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/assessments/${assessment.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", randomUUID())
      .send({
        expectedVersion: 1,
        status: "COMPLETED",
        resultWatts: 255,
        conditions: "室内骑行台",
        protocol: "FTP_TEST",
        actualDate: assessmentInput.localDate,
        source: "TRAINER",
        rpe: 8,
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
  it("race lifecycle covers cross-week draft, reentry, regeneration, reschedule and cancellation", async () => {
    const shift = (day: string, days: number) =>
      new Date(Date.parse(day) + days * 86400000).toISOString().slice(0, 10);
    const start = monday();
    const end = shift(start, 13);
    await post("me/ability-measurements/ftp")
      .send({
        valueWatts: 200,
        measuredAt: new Date().toISOString(),
        source: "MANUAL",
      })
      .expect(201);
    await request(app.getHttpServer())
      .put("/api/v1/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "Asia/Shanghai",
        weekdays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          availableMinutes: 90,
        })),
        maxSessionMinutes: 90,
      })
      .expect(200);
    const goal = (
      await post("goals")
        .send({
          type: "ENDURANCE",
          targetDate: "2030-12-31",
          priority: "PRIMARY",
        })
        .expect(201)
    ).body;
    const race = (
      await post("races")
        .send({
          name: "跨周赛事",
          localDate: shift(start, 6),
          timezone: "Asia/Shanghai",
          distanceKm: 100,
          priority: "A",
        })
        .expect(201)
    ).body;
    model.generate.mockImplementation(
      async (req: { messages: { content: string }[] }) => {
        const context = JSON.parse(req.messages[2].content) as {
          allowedDates: string[];
          weekStartDate: string;
          endDate?: string;
        };
        const eligibleWeeks = new Map<string, string>();
        for (const day of context.allowedDates) {
          const weekday = new Date(day).getUTCDay();
          const week = shift(day, -((weekday + 6) % 7));
          if (!eligibleWeeks.has(week)) eligibleWeeks.set(week, day);
        }
        return {
          text: JSON.stringify({
            summary: "赛事范围计划",
            stageSummary: "兼顾减量和恢复",
            assessmentSuggestion: "恢复后复评",
            workouts: [...eligibleWeeks.values()].map((day) => ({
              scheduledDate: day,
              title: "低强度骑行",
              purpose: "恢复与耐力",
              segments: [
                {
                  type: "work",
                  target: { kind: "duration", value: 30, unit: "min" },
                  intensity: { kind: "ftp_percent", min: 50, max: 65 },
                },
              ],
            })),
          }),
          requestId: randomUUID(),
          model: "mock-coach",
        };
      },
    );
    const stateUrl = `races/${race.id}/training-proposal`;
    const before = await get(stateUrl).expect(200);
    expect(before.body.proposal).toBeNull();
    expect(before.body.endDate).toBe(shift(race.localDate, 7));
    await request(app.getHttpServer()).get(`/api/v1/${stateUrl}`).expect(401);
    const other = await register();
    await get(stateUrl, other.tokens.accessToken).expect(404);
    const payload = {
      weekStartDate: start,
      endDate: end,
      goalId: goal.id,
      mode: "range",
      expectedBaseVersion: 0,
      relatedVersion: 1,
      racePhase: "PREPARATION",
    };
    const submitted = await post(`races/${race.id}/replan-proposal`)
      .set("Idempotency-Key", randomUUID())
      .send(payload)
      .expect(202);
    const job = await waitForGeneration(submitted.body.generationId);
    expect(job.status).toBe("READY");
    expect((await get(stateUrl).expect(200)).body.proposal.proposalId).toBe(
      job.proposalId,
    );
    const applyKey = randomUUID();
    await post(`proposals/${job.proposalId}/apply`)
      .set("Idempotency-Key", applyKey)
      .send({ expectedBaseVersion: 0 })
      .expect(201);
    await post(`proposals/${job.proposalId}/apply`)
      .set("Idempotency-Key", applyKey)
      .send({ expectedBaseVersion: 0 })
      .expect(201);
    expect((await get(stateUrl).expect(200)).body.proposal.status).toBe(
      "APPLIED",
    );
    const count = await prisma.aiGeneration.count({
      where: { userId, scene: "RACE_REPLAN" },
    });
    const reused = await post(`races/${race.id}/replan-proposal`)
      .set("Idempotency-Key", randomUUID())
      .send({ ...payload, expectedBaseVersion: 1 })
      .expect(202);
    expect(reused.body.generationId).toBe(job.generationId);
    expect(
      await prisma.aiGeneration.count({
        where: { userId, scene: "RACE_REPLAN" },
      }),
    ).toBe(count);
    const regenerated = await post(`races/${race.id}/replan-proposal`)
      .set("Idempotency-Key", randomUUID())
      .send({ ...payload, expectedBaseVersion: 1, forceRegenerate: true })
      .expect(202);
    const newJob = await waitForGeneration(regenerated.body.generationId);
    expect(newJob.status).toBe("READY");
    expect(
      (await get("plans/active/status").expect(200)).body.planVersion,
    ).toBe(1);
    expect((await get(stateUrl).expect(200)).body.proposal.proposalId).toBe(
      newJob.proposalId,
    );
    const pendingRaceJob = await prisma.aiGeneration.create({
      data: {
        userId,
        scene: "RACE_REPLAN",
        status: "RUNNING",
        input: { ...payload, relatedId: race.id },
        idempotencyKey: randomUUID(),
        leaseUntil: new Date(Date.now() + 60000),
      },
    });
    const nutritionDraft = await prisma.nutritionProposal.create({
      data: { userId, proposalType: "AI_PLAN", status: "READY", draft: {} },
    });
    await prisma.aiGeneration.create({
      data: {
        userId,
        scene: "NUTRITION_PLAN",
        status: "READY",
        input: { raceId: race.id },
        proposalId: nutritionDraft.id,
        idempotencyKey: randomUUID(),
      },
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/races/${race.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expectedVersion: 1, localDate: shift(start, 7) })
      .expect(200);
    expect(
      (
        await prisma.aiGeneration.findUniqueOrThrow({
          where: { id: pendingRaceJob.id },
        })
      ).status,
    ).toBe("FAILED");
    expect(
      (
        await prisma.nutritionProposal.findUniqueOrThrow({
          where: { id: nutritionDraft.id },
        })
      ).status,
    ).toBe("EXPIRED");

    expect((await get(stateUrl).expect(200)).body.proposal).toBeNull();
    await post(`proposals/${newJob.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/races/${race.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expectedVersion: 2, status: "CANCELLED" })
      .expect(200);
    const cancelled = (await get(stateUrl).expect(200)).body;
    expect(cancelled.phase).toBe("RETURN_TO_GOAL");
    expect(cancelled.startDate).toBe(cancelled.today);
    expect(
      (await get("plans/active/status").expect(200)).body.planVersion,
    ).toBe(1);
    const rejoin = await post(`races/${race.id}/replan-proposal`)
      .set("Idempotency-Key", randomUUID())
      .send({
        ...payload,
        weekStartDate: cancelled.startDate,
        endDate: cancelled.endDate,
        expectedBaseVersion: 1,
        relatedVersion: 3,
        racePhase: "RETURN_TO_GOAL",
      })
      .expect(202);
    expect((await waitForGeneration(rejoin.body.generationId)).status).toBe(
      "READY",
    );
    const old = (
      await post("races")
        .send({
          name: "已结束赛事",
          localDate: shift(cancelled.today, -20),
          timezone: "Asia/Shanghai",
          distanceKm: 80,
          priority: "B",
        })
        .expect(201)
    ).body;
    await post(`races/${old.id}/result`)
      .send({ actualDate: old.localDate, status: "COMPLETED", fatigue: 7 })
      .expect(201);
    const recovery = (
      await get(`races/${old.id}/training-proposal`).expect(200)
    ).body;
    await post(`races/${old.id}/result`)
      .send({ actualDate: old.localDate, status: "COMPLETED", fatigue: 5 })
      .expect(409);
    await post(`races/${old.id}/result`)
      .send({
        actualDate: shift(recovery.today, 1),
        status: "COMPLETED",
        expectedVersion: 1,
      })
      .expect(400);
    const repeatedResult = await post(`races/${old.id}/result`)
      .send({ actualDate: old.localDate, status: "COMPLETED", fatigue: 7 })
      .expect(201);
    expect(repeatedResult.body.version).toBe(1);
    expect(recovery.phase).toBe("RECOVERY");
    expect(recovery.startDate).toBe(recovery.today);
    const recovering = await post(`races/${old.id}/replan-proposal`)
      .set("Idempotency-Key", randomUUID())
      .send({
        ...payload,
        weekStartDate: recovery.startDate,
        endDate: recovery.endDate,
        expectedBaseVersion: 1,
        relatedVersion: 2,
        racePhase: "RECOVERY",
      })
      .expect(202);
    expect((await waitForGeneration(recovering.body.generationId)).status).toBe(
      "READY",
    );
    const impact = (
      await get(
        `races/${race.id}/impact-preview?startDate=${start}&endDate=${end}`,
      ).expect(200)
    ).body;
    expect(impact.workouts.length).toBeGreaterThan(0);
    expect(impact.affectedDates).toHaveLength(14);
  });
});
