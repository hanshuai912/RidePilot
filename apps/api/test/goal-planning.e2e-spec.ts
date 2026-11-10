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
  // Reuse one data-empty outsider so this suite stays below the real per-IP
  // registration limit while exercising actual authentication and ownership.
  let outsider: { tokens: { accessToken: string } } | undefined;
  const registerOther = async () => {
    if (outsider) return outsider;
    const auth: { tokens: { accessToken: string } } = await register();
    outsider = auth;
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
    const other = await registerOther();
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
    const second = await generateStages(20);
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
    const other = await registerOther();
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

  const goalChange = async (
    action: string,
    changes?: object,
    nextGoal?: object,
  ) => {
    const current = (await get(`goals/${goalId}`).expect(200)).body;
    const change = {
      action,
      expectedVersion: current.version,
      reason: "根据实测与训练时间重新选择",
      ...(changes ? { changes } : {}),
      ...(nextGoal ? { nextGoal } : {}),
    };
    const preview = (
      await post(`goals/${goalId}/change-preview`).send(change).expect(201)
    ).body;
    return { change, preview };
  };
  const applyGoal = async (
    action: string,
    changes?: object,
    nextGoal?: object,
  ) => {
    const { change, preview } = await goalChange(action, changes, nextGoal);
    return (
      await post(`goals/${goalId}/changes`)
        .set("Idempotency-Key", randomUUID())
        .send({ change, fingerprint: preview.fingerprint })
        .expect(201)
    ).body;
  };
  const reviewState = async (stageId: string) =>
    (await get(`stages/${stageId}/review`).expect(200)).body;
  const saveReview = async (
    stageId: string,
    decision = "ADJUST",
    outcome = "INSUFFICIENT",
  ) => {
    const state = await reviewState(stageId);
    const input = {
      fingerprint: state.snapshot.fingerprint,
      expectedReviewId: state.history[0]?.id ?? null,
      outcome,
      decision,
      rationale: "核对阶段训练与实际记录，保留不确定性",
    };
    const key = randomUUID();
    const result = (
      await post(`stages/${stageId}/reviews`)
        .set("Idempotency-Key", key)
        .send(input)
        .expect(201)
    ).body;
    return { result, input, key };
  };
  const activeStage = async () => {
    const draft = await generateStages();
    return (
      await post(`stage-plans/${draft.id}/activate`)
        .send({ expectedVersion: 1 })
        .expect(201)
    ).body;
  };
  const setCriteria = (
    stageId: string,
    criteria = "同路线完成耐力骑行并记录感受",
    expectedVersion = 1,
  ) =>
    request(app.getHttpServer())
      .put(`/api/v1/stages/${stageId}/criteria`)
      .set("Authorization", `Bearer ${token}`)
      .send({ criteria, expectedVersion });

  it("previews and records pause/resume/complete/next goal, preserves formal workouts and retries exactly once", async () => {
    await manual(start, "保留正式课程", 0);
    const before = await prisma.trainingPlan.findFirstOrThrow({
      where: { userId },
    });
    const paused = await applyGoal("PAUSE");
    expect(paused.goal.status).toBe("PAUSED");
    await applyGoal("RESUME");
    await applyGoal("UPDATE", {
      targetDate: addDays(start, 200),
    });
    const { change, preview } = await goalChange("COMPLETE", {
      successCriteria: "完成百公里并保存实际记录",
    });
    expect(preview.affected.workouts).toHaveLength(1);
    expect(preview.before.successCriteria).toBeNull();
    expect(
      (await get(`goals/${goalId}`).expect(200)).body.successCriteria,
    ).toBeNull();
    const key = randomUUID();
    const body = { change, fingerprint: preview.fingerprint };
    const first = (
      await post(`goals/${goalId}/changes`)
        .set("Idempotency-Key", key)
        .send(body)
        .expect(201)
    ).body;
    const second = (
      await post(`goals/${goalId}/changes`)
        .set("Idempotency-Key", key)
        .send(body)
        .expect(201)
    ).body;
    expect(second).toEqual(first);
    expect(first.goal.closureReason).toBe("COMPLETED");
    expect(first.goal.successCriteria).toBe("完成百公里并保存实际记录");
    await post(`goals/${goalId}/changes`)
      .set("Idempotency-Key", key)
      .send({ ...body, change: { ...change, reason: "不同输入" } })
      .expect(409);
    const next = await applyGoal("CREATE_NEXT", undefined, {
      type: "CUSTOM",
      targetDate: addDays(start, 210),
      priority: "PRIMARY",
      successCriteria: "记录新的路线成绩",
    });
    expect(next.nextGoal).toMatchObject({
      status: "ACTIVE",
      type: "CUSTOM",
      version: 1,
    });
    expect(
      (await get(`goals/${goalId}/overview`).expect(200)).body.history.length,
    ).toBeGreaterThanOrEqual(6);
    expect(
      (await prisma.trainingPlan.findFirstOrThrow({ where: { userId } }))
        .activeVersionId,
    ).toBe(before.activeVersionId);
    expect(await prisma.trainingStageReview.count({ where: { userId } })).toBe(
      0,
    );
    {
      goalId = next.nextGoal.id;
      const originalId = goalId;
      await applyGoal("CLOSE");
      const closed = (await get(`goals/${originalId}`).expect(200)).body;
      const input = {
        type: "CUSTOM",
        targetDate: addDays(start, 80),
        priority: "SECONDARY",
        description: "新的独立目标",
      };
      await post("goals/evaluate").send(input).expect(409);
      await post("goals")
        .set("Idempotency-Key", randomUUID())
        .send(input)
        .expect(409);
      expect(await prisma.trainingGoal.count({ where: { userId } })).toBe(2);
      await post("goals/evaluate")
        .send({ ...input, priority: "PRIMARY" })
        .expect(201);
      const key = randomUUID();
      const added = (
        await post("goals")
          .set("Idempotency-Key", key)
          .send({ ...input, priority: "PRIMARY" })
          .expect(201)
      ).body;
      expect(added.id).not.toBe(originalId);
      expect(added.priority).toBe("PRIMARY");
      expect((await get(`goals/${originalId}`).expect(200)).body).toEqual(
        closed,
      );
      expect(
        (
          await post("goals")
            .set("Idempotency-Key", key)
            .send({ ...input, priority: "PRIMARY" })
            .expect(201)
        ).body,
      ).toEqual(added);
      const rejected = (
        await post(`goals/${added.id}/change-preview`)
          .send({
            action: "UPDATE",
            expectedVersion: added.version,
            reason: "唯一目标不能直接降级",
            changes: { priority: "SECONDARY" },
          })
          .expect(400)
      ).body;
      expect(rejected.code).toBe("PRIMARY_GOAL_REPLACEMENT_REQUIRED");
      expect((await get(`goals/${added.id}`).expect(200)).body.priority).toBe(
        "PRIMARY",
      );
    }
  });

  it("completes expired goals with criteria in one confirmed change and rejects unrelated edits or stale criteria", async () => {
    await prisma.trainingGoal.update({
      where: { id: goalId },
      data: { targetDate: new Date("2020-01-01") },
    });
    const current = (await get(`goals/${goalId}`).expect(200)).body;
    const base = {
      action: "COMPLETE",
      expectedVersion: current.version,
      reason: "已完成百公里，实际记录可核对",
    };
    for (const changes of [
      undefined,
      { successCriteria: null },
      { successCriteria: "  " },
      { successCriteria: "完成百公里", targetDate: addDays(start, 40) },
      { successCriteria: "完成百公里", priority: "SECONDARY" },
    ]) {
      await post(`goals/${goalId}/change-preview`)
        .send({ ...base, ...(changes ? { changes } : {}) })
        .expect(400);
    }
    for (const action of ["PAUSE", "CLOSE"]) {
      await post(`goals/${goalId}/change-preview`)
        .send({ ...base, action, changes: { successCriteria: "完成百公里" } })
        .expect(400);
    }
    const change = { ...base, changes: { successCriteria: "完成百公里" } };
    const preview = (
      await post(`goals/${goalId}/change-preview`).send(change).expect(201)
    ).body;
    expect(preview.after).toMatchObject({
      targetDate: "2020-01-01",
      successCriteria: "完成百公里",
      status: "CLOSED",
      closureReason: "COMPLETED",
    });
    expect((await get(`goals/${goalId}`).expect(200)).body).toMatchObject({
      successCriteria: null,
      status: "ACTIVE",
      version: current.version,
    });
    await post(`goals/${goalId}/changes`)
      .set("Idempotency-Key", randomUUID())
      .send({
        change: { ...change, changes: { successCriteria: "改变核对条件" } },
        fingerprint: preview.fingerprint,
      })
      .expect(409);
    expect(
      await prisma.goalMutation.count({
        where: { userId, goalId, action: "COMPLETE" },
      }),
    ).toBe(0);
    const result = (
      await post(`goals/${goalId}/changes`)
        .set("Idempotency-Key", randomUUID())
        .send({ change, fingerprint: preview.fingerprint })
        .expect(201)
    ).body;
    expect(result.goal).toMatchObject({
      targetDate: "2020-01-01",
      successCriteria: "完成百公里",
      status: "CLOSED",
      closureReason: "COMPLETED",
      version: current.version + 1,
    });
    expect(
      await prisma.goalMutation.count({
        where: { userId, goalId, action: "COMPLETE" },
      }),
    ).toBe(1);
  });

  it("evaluates facts without AI, prevents silent primary replacement and atomically switches primary goals", async () => {
    {
      await prisma.trainingGoal.update({
        where: { id: goalId },
        data: { priority: "SECONDARY" },
      });
      const { change, preview } = await goalChange("UPDATE", {
        description: "保持当前唯一目标",
      });
      expect(preview.before.priority).toBe("SECONDARY");
      expect(preview.after.priority).toBe("PRIMARY");
      expect((await get(`goals/${goalId}`).expect(200)).body.priority).toBe(
        "SECONDARY",
      );
      const applied = (
        await post(`goals/${goalId}/changes`)
          .set("Idempotency-Key", randomUUID())
          .send({ change, fingerprint: preview.fingerprint })
          .expect(201)
      ).body;
      expect(applied.goal.priority).toBe("PRIMARY");
    }
    const input = {
      type: "FTP",
      targetFtpWatts: 300,
      successCriteria: "有效 FTP 实测",
      targetDate: addDays(start, 80),
      priority: "PRIMARY",
    };
    const evaluated = (await post("goals/evaluate").send(input).expect(201))
      .body;
    expect(evaluated.evaluation).toMatchObject({
      wattsGap: 50,
      weeklyMinutes: 630,
    });
    await post("goals").send(input).expect(409);
    const key = randomUUID();
    const original = (await get(`goals/${goalId}`).expect(200)).body;
    const secondary = (
      await post("goals")
        .set("Idempotency-Key", key)
        .send({ ...input, priority: "SECONDARY" })
        .expect(201)
    ).body;
    expect(secondary.id).not.toBe(goalId);
    expect((await get(`goals/${goalId}`).expect(200)).body).toEqual(original);
    expect(
      (
        await post("goals")
          .set("Idempotency-Key", key)
          .send({ ...input, priority: "SECONDARY" })
          .expect(201)
      ).body.id,
    ).toBe(secondary.id);

    const oldId = goalId;
    await post(`goals/${oldId}/change-preview`)
      .send({
        action: "UPDATE",
        expectedVersion: original.version,
        reason: "尝试直接降级",
        changes: { priority: "SECONDARY" },
      })
      .expect(400);
    goalId = secondary.id;
    const { preview } = await goalChange("UPDATE", { priority: "PRIMARY" });
    expect(
      preview.affected.otherPrimaryGoals.map((g: { id: string }) => g.id),
    ).toEqual([oldId]);
    await applyGoal("UPDATE", { priority: "PRIMARY" });
    expect((await get(`goals/${oldId}`).expect(200)).body).toMatchObject({
      priority: "SECONDARY",
      version: original.version + 1,
    });
    expect(
      await prisma.trainingGoal.count({
        where: { userId, priority: "PRIMARY", status: "ACTIVE" },
      }),
    ).toBe(1);
    expect(model.generate).not.toHaveBeenCalled();
    const openapi = (
      await request(app.getHttpServer()).get("/api/docs-json").expect(200)
    ).body;
    expect(
      openapi.paths["/api/v1/goals/{id}/changes"].post.requestBody.content[
        "application/json"
      ].schema.properties.fingerprint,
    ).toBeDefined();
    expect(
      openapi.paths["/api/v1/stages/{id}/reviews"].post.responses["201"]
        .content["application/json"].schema.properties.snapshot,
    ).toBeDefined();
  });

  it("extends expired goals, rejects completion without criteria and rejects concurrent or outdated previews", async () => {
    await prisma.trainingGoal.update({
      where: { id: goalId },
      data: { targetDate: new Date("2020-01-01") },
    });
    const current = (await get(`goals/${goalId}`).expect(200)).body;
    await post(`goals/${goalId}/change-preview`)
      .send({
        action: "COMPLETE",
        expectedVersion: current.version,
        reason: "日期到期",
      })
      .expect(400);
    const first = await goalChange("UPDATE", {
      targetDate: addDays(start, 40),
    });
    await ftp();
    await post(`goals/${goalId}/changes`)
      .set("Idempotency-Key", randomUUID())
      .send({ change: first.change, fingerprint: first.preview.fingerprint })
      .expect(409);
    const fresh = await goalChange("UPDATE", {
      targetDate: addDays(start, 40),
    });
    const results = await Promise.all(
      [1, 2].map(() =>
        post(`goals/${goalId}/changes`)
          .set("Idempotency-Key", randomUUID())
          .send({
            change: fresh.change,
            fingerprint: fresh.preview.fingerprint,
          }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await get(`goals/${goalId}`).expect(200)).body.targetDate).toBe(
      addDays(start, 40),
    );
  });

  it("requires authentication and isolates goal/stage review writes and reads", async () => {
    const active = await activeStage();
    const id = active.stages[0].id;
    const other = await registerOther();
    const access = other.tokens.accessToken;
    await get(`goals/${goalId}/overview`, access).expect(404);
    await get(`stages/${id}/review`, access).expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/stages/${id}/review`)
      .expect(401);
    await request(app.getHttpServer())
      .put(`/api/v1/stages/${id}/criteria`)
      .set("Authorization", `Bearer ${access}`)
      .send({ expectedVersion: 1, criteria: "不得修改他人阶段" })
      .expect(404);
    const state = await reviewState(id);
    await post(`stages/${id}/reviews`, access)
      .set("Idempotency-Key", randomUUID())
      .send({
        fingerprint: state.snapshot.fingerprint,
        expectedReviewId: null,
        decision: "KEEP",
        outcome: "INSUFFICIENT",
        rationale: "隔离检查",
      })
      .expect(404);
  });

  it("persists criteria and immutable evidence, prevents future achievement and concurrent decisions", async () => {
    const active = await activeStage();
    const id = active.stages[0].id;
    let state = await reviewState(id);
    const base = {
      fingerprint: state.snapshot.fingerprint,
      expectedReviewId: null,
      outcome: "MET",
      decision: "NEXT",
      rationale: "确认阶段达成",
    };
    await post(`stages/${id}/reviews`)
      .set("Idempotency-Key", randomUUID())
      .send(base)
      .expect(400);
    await setCriteria(id).expect(200);
    await setCriteria(id).expect(200);
    await setCriteria(id, "并发条件", 1).expect(409);
    state = await reviewState(id);
    await post(`stages/${id}/reviews`)
      .set("Idempotency-Key", randomUUID())
      .send({ ...base, fingerprint: state.snapshot.fingerprint })
      .expect(400);
    const saved = await saveReview(id);
    expect(
      (
        await post(`stages/${id}/reviews`)
          .set("Idempotency-Key", saved.key)
          .send(saved.input)
          .expect(201)
      ).body,
    ).toEqual(saved.result);
    await post(`stages/${id}/reviews`)
      .set("Idempotency-Key", saved.key)
      .send({ ...saved.input, decision: "EXTEND" })
      .expect(409);
    await post(`stages/${id}/reviews`)
      .set("Idempotency-Key", randomUUID())
      .send(saved.input)
      .expect(409);
    await setCriteria(id, "新的达成条件", 2).expect(200);
    expect((await reviewState(id)).history[0].snapshot.criteria).toBe(
      "同路线完成耐力骑行并记录感受",
    );
    expect(model.generate).toHaveBeenCalledTimes(1);
  });

  it("binds a real review to a course draft and publishes only after validation and confirmation", async () => {
    const active = await activeStage();
    const id = active.stages[0].id;
    await setCriteria(id).expect(200);
    const { result } = await saveReview(id, "KEEP");
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "STAGE",
          goalId,
          stageId: id,
          stageReviewId: result.id,
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("READY");
    const draft = (await get(`proposals/${finished.proposalId}`).expect(200))
      .body;
    expect(draft.stageReview).toEqual(result);
    const tracked = (await reviewState(id)).followups;
    expect(tracked).toContainEqual(
      expect.objectContaining({
        generationId: job.generationId,
        reviewId: result.id,
        status: "READY",
        kind: "COURSES",
        proposalId: finished.proposalId,
      }),
    );

    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    expect(
      (await post(`proposals/${finished.proposalId}/validate`).expect(201)).body
        .status,
    ).toBe("READY");
    const applied = (
      await post(`proposals/${finished.proposalId}/apply`)
        .set("Idempotency-Key", randomUUID())
        .send({ expectedBaseVersion: 0 })
        .expect(201)
    ).body;
    expect(applied.newPlanVersion).toBe(1);
    expect((await reviewState(id)).history[0].id).toBe(result.id);
  });

  it("invalidates pending course evidence when a new review replaces its decision", async () => {
    const active = await activeStage();
    const id = active.stages[0].id;
    const { result } = await saveReview(id, "KEEP");
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "STAGE",
          goalId,
          stageId: id,
          stageReviewId: result.id,
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("READY");
    await saveReview(id, "ADJUST");
    const validation = (
      await post(`proposals/${finished.proposalId}/validate`).expect(201)
    ).body;
    expect(validation.status).toBe("BLOCKED");
    expect(validation.blockers.join(" ")).toContain("阶段复评");
    await post(`proposals/${finished.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0 })
      .expect(409);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
  });

  it("extends with an explicit stage draft, exposes stale evidence and never archives the active plan on failed confirmation", async () => {
    const active = await activeStage();
    const id = active.stages[0].id;
    const { result } = await saveReview(id, "EXTEND");
    await post("plans/generate-range-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        scope: "STAGE",
        goalId,
        stageId: id,
        stageReviewId: result.id,
        expectedBaseVersion: 0,
      })
      .expect(409);
    const job = (
      await post("stage-plans/generate-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          goalId,
          stageReviewId: result.id,
          startDate: start,
          endDate: addDays(start, 20),
        })
        .expect(202)
    ).body;
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("READY");
    expect(
      (await get(`stage-plans/${finished.proposalId}`).expect(200)).body
        .stageReview.id,
    ).toBe(result.id);
    await setCriteria(id).expect(200);
    expect(
      (await get(`stage-plans/${finished.proposalId}`).expect(200)).body.stale,
    ).toBe(true);
    await post(`stage-plans/${finished.proposalId}/activate`)
      .send({ expectedVersion: 1 })
      .expect(409);
    expect(
      (await get(`goals/${goalId}/stage-plan`).expect(200)).body.plan.id,
    ).toBe(active.id);
  });

  it("allows NEXT only for confirmed achievement and binds its course range to the next stage", async () => {
    start = new Date().toISOString().slice(0, 10);
    const active = await activeStage();
    const id = active.stages[0].id;
    await setCriteria(id).expect(200);
    const { result } = await saveReview(id, "NEXT", "MET");
    await post("plans/generate-range-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        scope: "STAGE",
        goalId,
        stageId: id,
        stageReviewId: result.id,
        expectedBaseVersion: 0,
      })
      .expect(400);
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "STAGE",
          goalId,
          stageId: active.stages[1].id,
          stageReviewId: result.id,
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    expect((await wait(job.generationId)).status).toBe("READY");
  });

  it("rechecks changed training feedback at apply time even after successful draft validation", async () => {
    start = new Date().toISOString().slice(0, 10);
    await manual(start, "实际执行课程", 0);
    const active = await activeStage();
    const stageId = active.stages[0].id;
    const { result } = await saveReview(stageId, "KEEP");
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "STAGE",
          goalId,
          stageId,
          stageReviewId: result.id,
          expectedBaseVersion: 1,
        })
        .expect(202)
    ).body;
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("READY");
    expect(
      (await post(`proposals/${finished.proposalId}/validate`).expect(201)).body
        .status,
    ).toBe("READY");
    const workout = (
      await get(`calendar?from=${start}&to=${start}`).expect(200)
    ).body.items[0];
    await post("activities")
      .send({
        workoutId: workout.id,
        localDate: start,
        status: "COMPLETED",
        durationMin: 30,
        rpe: 4,
        fatigue: 2,
      })
      .expect(201);
    expect((await reviewState(stageId)).snapshot.fingerprint).not.toBe(
      result.snapshot.fingerprint,
    );
    await post(`proposals/${finished.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 1 })
      .expect(409);
    const plan = await prisma.trainingPlan.findFirstOrThrow({
      where: { userId },
      include: { activeVersion: true },
    });
    expect(plan.activeVersion?.versionNo).toBe(1);
    expect(
      (await reviewState(stageId)).history[0].snapshot.training.completed,
    ).toBe(0);
  });

  it("rejects review-based generation if its evidence changes while the model is running", async () => {
    const active = await activeStage();
    const stageId = active.stages[0].id;
    const { result } = await saveReview(stageId, "KEEP");
    const original = model.generate.getMockImplementation()!;
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = new Promise<void>((resolve) => {
      entered = resolve;
    });
    model.generate.mockImplementation(async (input) => {
      entered();
      await gate;
      return original(input);
    });
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "STAGE",
          goalId,
          stageId,
          stageReviewId: result.id,
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    try {
      await running;
      await setCriteria(stageId).expect(200);
    } finally {
      release();
    }
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("FAILED");
    expect(finished.proposalId).toBeNull();
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
  });

  it("confirms a reviewed extension as a new stage arrangement without marking its historical source stale", async () => {
    const active = await activeStage();
    const stageId = active.stages[0].id;
    const { result } = await saveReview(stageId, "EXTEND");
    const job = (
      await post("stage-plans/generate-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          goalId,
          stageReviewId: result.id,
          startDate: start,
          endDate: addDays(start, 20),
        })
        .expect(202)
    ).body;
    const finished = await wait(job.generationId);
    expect(finished.status).toBe("READY");
    const confirmed = (
      await post(`stage-plans/${finished.proposalId}/activate`)
        .send({ expectedVersion: 1 })
        .expect(201)
    ).body;
    expect(confirmed).toMatchObject({
      status: "ACTIVE",
      stale: false,
      stageReview: { id: result.id },
    });
    expect(
      (await get(`stage-plans/${active.id}`).expect(200)).body.status,
    ).toBe("ARCHIVED");
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
  });
});
