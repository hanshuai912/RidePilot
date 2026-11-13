import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import { AiService } from "../src/ai/ai.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import type { Prisma } from "../src/generated/prisma/client";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
describeDb("course generation with automatic stages", () => {
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
  const generateCourses = async (offset = 0, version = 0) => {
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "DATES",
          goalId,
          startDate: addDays(start, offset),
          endDate: addDays(start, offset + 13),
          expectedBaseVersion: version,
        })
        .expect(202)
    ).body;
    const done = await wait(job.generationId);
    expect(done.status).toBe("READY");
    return (await get(`proposals/${done.proposalId}`).expect(200)).body;
  };
  const applyCourses = (
    proposal: {
      proposalId: string;
      basePlanVersion: number;
      proposalVersion: number;
    },
    key = randomUUID(),
  ) =>
    post(`proposals/${proposal.proposalId}/apply`)
      .set("Idempotency-Key", key)
      .send({
        expectedBaseVersion: proposal.basePlanVersion,
        expectedProposalVersion: proposal.proposalVersion,
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
            stages:
              payload.stagePlanning && payload.stagePlanning.action !== "REUSE"
                ? Array.from(
                    {
                      length: Math.ceil(
                        (Date.parse(payload.stagePlanning.endDate) -
                          Date.parse(payload.stagePlanning.startDate) +
                          86400000) /
                          (84 * 86400000),
                      ),
                    },
                    (_, index) => ({
                      title: "配套耐力阶段",
                      purpose: "耐力",
                      assessmentSuggestion: "复评",
                      startDate: addDays(
                        payload.stagePlanning.startDate,
                        index * 84,
                      ),
                      endDate:
                        addDays(
                          payload.stagePlanning.startDate,
                          index * 84 + 83,
                        ) < payload.stagePlanning.endDate
                          ? addDays(
                              payload.stagePlanning.startDate,
                              index * 84 + 83,
                            )
                          : payload.stagePlanning.endDate,
                    }),
                  )
                : undefined,
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

  it("creates stages together with the initial weekly plan and considers all active goals", async () => {
    await prisma.trainingGoal.create({
      data: {
        userId,
        type: "FTP",
        priority: "SECONDARY",
        targetFtpWatts: 270,
        targetDate: new Date(addDays(start, 90)),
      },
    });
    const baseModel = model.generate.getMockImplementation()!;
    model.generate.mockImplementation(async (...args: unknown[]) => {
      const response = await baseModel(...args);
      return {
        ...response,
        text: JSON.stringify({
          ...JSON.parse(response.text),
          goalTradeoffs: ["优先耐力，兼顾阈值"],
        }),
      };
    });
    const job = (
      await post("plans/generate-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          weekStartDate: start,
          goalId,
          mode: "initial",
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    const done = await wait(job.generationId);
    expect(done.status).toBe("READY");
    const proposal = (await get(`proposals/${done.proposalId}`).expect(200))
      .body;
    expect(proposal.stagePlan.action).toBe("CREATE");
    expect(proposal.stagePlan.endDate).toBe(addDays(start, 6));
    expect(proposal.planningGoals).toHaveLength(2);
    await applyCourses(proposal).expect(201);
    const active = (await get(`goals/${goalId}/stage-plan`).expect(200)).body
      .plan;
    expect(active.planningGoals).toHaveLength(2);
    expect(active.goalTradeoffs).toEqual(["优先耐力，兼顾阈值"]);
    expect(active.stale).toBe(false);
  });

  it("previews course stages without publishing, atomically applies both and replays without duplicate stages", async () => {
    const proposal = await generateCourses();
    expect(proposal.stagePlan).toMatchObject({
      action: "CREATE",
      startDate: start,
      endDate: addDays(start, 13),
    });
    expect(proposal.stagePlan.stages[0].purpose).toBe("耐力");
    expect(await prisma.trainingStagePlan.count({ where: { userId } })).toBe(0);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    const other = await registerOther();
    await post(
      `proposals/${proposal.proposalId}/apply`,
      other.tokens.accessToken,
    )
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0 })
      .expect(404);
    const transaction = prisma.$transaction.bind(prisma);
    const failure = jest.spyOn(prisma, "$transaction").mockImplementationOnce(((
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) =>
      transaction(async (tx) =>
        callback(
          new Proxy(tx, {
            get(target, property) {
              if (property === "workout")
                return new Proxy(target.workout, {
                  get(delegate, method) {
                    if (method === "create")
                      return async () => {
                        throw new Error("simulated workout write failure");
                      };
                    return Reflect.get(delegate, method);
                  },
                });
              return Reflect.get(target, property);
            },
          }),
        ),
      )) as typeof prisma.$transaction);
    try {
      await applyCourses(proposal).expect(500);
    } finally {
      failure.mockRestore();
    }
    expect(await prisma.trainingStagePlan.count({ where: { userId } })).toBe(0);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    expect(
      (await get(`proposals/${proposal.proposalId}`).expect(200)).body.status,
    ).toBe("READY");
    const key = randomUUID();
    const applied = (await applyCourses(proposal, key).expect(201)).body;
    expect(applied.newPlanVersion).toBe(1);
    expect((await applyCourses(proposal, key).expect(201)).body).toEqual(
      applied,
    );
    expect((await applyCourses(proposal).expect(201)).body).toEqual(applied);
    expect(
      await prisma.trainingStagePlan.count({
        where: { userId, status: "ACTIVE" },
      }),
    ).toBe(1);
    expect(await prisma.trainingAssessment.count({ where: { userId } })).toBe(
      0,
    );
    const active = (await get(`goals/${goalId}/stage-plan`).expect(200)).body
      .plan;
    expect(active.stale).toBe(false);
    expect(active.stages[0].purpose).toBe(proposal.stagePlan.stages[0].purpose);
    expect(active.startDate).toBe(start);
  });

  it("reuses existing confirmed stages when the course range is already covered", async () => {
    const draft = await generateStages();
    const active = (
      await post(`stage-plans/${draft.id}/activate`)
        .send({ expectedVersion: 1 })
        .expect(201)
    ).body;
    const proposal = await generateCourses();
    expect(proposal.stagePlan.action).toBe("REUSE");
    await applyCourses(proposal).expect(201);
    const after = (await get(`goals/${goalId}/stage-plan`).expect(200)).body
      .plan;
    expect(after.id).toBe(active.id);
    expect(after.version).toBe(active.version);
    expect(after.stages.map((s: { id: string }) => s.id)).toEqual(
      active.stages.map((s: { id: string }) => s.id),
    );
  });

  it("extends the shared roadmap preserving existing stage IDs and invalidates older stage and course drafts", async () => {
    const first = await generateCourses();
    await applyCourses(first).expect(201);
    const before = (await get(`goals/${goalId}/stage-plan`).expect(200)).body
      .plan;
    const oldStandalone = await generateStages(27);
    const extension = await generateCourses(14, 1);
    const concurrent = await generateCourses(21, 1);
    expect(extension.stagePlan.action).toBe("EXTEND");
    await applyCourses(extension).expect(201);
    const after = (await get(`goals/${goalId}/stage-plan`).expect(200)).body
      .plan;
    expect(after.id).toBe(before.id);
    expect(after.version).toBe(before.version + 1);
    expect(after.endDate).toBe(addDays(start, 27));
    expect(after.stages[0]).toMatchObject({
      id: before.stages[0].id,
      purpose: before.stages[0].purpose,
    });
    expect(after.stale).toBe(false);
    const validation = (
      await post(`proposals/${concurrent.proposalId}/validate`).expect(201)
    ).body;
    expect(validation.status).toBe("BLOCKED");
    expect(validation.blockers.join(" ")).toContain("阶段安排已变化");
    await post(`stage-plans/${oldStandalone.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(409);
  });

  it("replaces an outdated roadmap only when the associated courses are confirmed", async () => {
    const first = await generateCourses();
    await applyCourses(first).expect(201);
    const old = (await get(`goals/${goalId}/stage-plan`).expect(200)).body.plan;
    await ftp();
    const replacement = await generateCourses(14, 1);
    expect(replacement.stagePlan.action).toBe("REPLACE");
    expect(
      (await get(`goals/${goalId}/stage-plan`).expect(200)).body.plan.id,
    ).toBe(old.id);
    await applyCourses(replacement).expect(201);
    const active = (await get(`goals/${goalId}/stage-plan`).expect(200)).body
      .plan;
    expect(active.id).not.toBe(old.id);
    expect(active.stale).toBe(false);
    expect((await get(`stage-plans/${old.id}`).expect(200)).body.status).toBe(
      "ARCHIVED",
    );
  });

  it("rejects invalid combined stages without publishing either courses or stages", async () => {
    model.generate.mockImplementation(
      async (input: { messages: { content: string }[] }) => {
        const payload = JSON.parse(input.messages.at(-1)!.content);
        return {
          model: "invalid-combined",
          text: JSON.stringify({
            summary: "无效阶段",
            stageSummary: "耐力",
            assessmentSuggestion: "复评",
            workouts: [
              workout(payload.allowedDates[0]),
              workout(payload.allowedDates[7]),
            ],
            stages: [
              {
                title: "缺少首日",
                purpose: "耐力",
                assessmentSuggestion: "复评",
                startDate: addDays(start, 1),
                endDate: addDays(start, 13),
              },
            ],
          }),
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
          endDate: addDays(start, 13),
          expectedBaseVersion: 0,
        })
        .expect(202)
    ).body;
    expect((await wait(job.generationId)).status).toBe("FAILED");
    expect(await prisma.trainingStagePlan.count({ where: { userId } })).toBe(0);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
  });
});
