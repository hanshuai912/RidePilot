import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import { AiService } from "../src/ai/ai.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const offset = (day: string, n: number) =>
  new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10);
describeDb("unified planning across active goals", () => {
  jest.setTimeout(30000);
  let app: INestApplication,
    db: PrismaService,
    token: string,
    userId: string,
    primaryId: string,
    start: string;
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
  const wait = async (id: string) => {
    for (let n = 0; n < 80; n++) {
      const job = (await get(`ai-coach/generations/${id}`).expect(200)).body;
      if (["READY", "FAILED"].includes(job.status)) return job;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error("generation timeout");
  };
  const secondary = async () =>
    (
      await post("goals")
        .send({
          type: "ENDURANCE",
          description: "完成百公里",
          priority: "SECONDARY",
          targetDate: offset(start, 180),
        })
        .expect(201)
    ).body;
  const stages = async (goalId = primaryId) => {
    const job = (
      await post("stage-plans/generate-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({ goalId, startDate: start, endDate: offset(start, 13) })
        .expect(202)
    ).body;
    const done = await wait(job.generationId);
    expect(done.status).toBe("READY");
    return (await get(`stage-plans/${done.proposalId}`).expect(200)).body;
  };
  const courses = async (
    goalId = primaryId,
    base = 0,
    assessment?: { id: string; version: number },
  ) => {
    const job = (
      await post("plans/generate-range-proposal")
        .set("Idempotency-Key", randomUUID())
        .send({
          scope: "DATES",
          goalId,
          startDate: start,
          endDate: offset(start, 13),
          expectedBaseVersion: base,
          ...(assessment
            ? {
                assessmentId: assessment.id,
                assessmentVersion: assessment.version,
              }
            : {}),
        })
        .expect(202)
    ).body;
    const done = await wait(job.generationId);
    expect(done.status).toBe("READY");
    return (await get(`proposals/${done.proposalId}`).expect(200)).body;
  };
  const change = async (id: string, changes: Record<string, unknown>) => {
    const goal = (await get(`goals/${id}`).expect(200)).body;
    const input = {
      action: "UPDATE",
      expectedVersion: goal.version,
      reason: "修改目标规划",
      changes,
    };
    const preview = (
      await post(`goals/${id}/change-preview`).send(input).expect(201)
    ).body;
    return (
      await post(`goals/${id}/changes`)
        .set("Idempotency-Key", randomUUID())
        .send({ change: input, fingerprint: preview.fingerprint })
        .expect(201)
    ).body;
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
    token = auth.tokens.accessToken;
    userId = auth.user.id;
    users.push(userId);
    start = offset(new Date().toISOString().slice(0, 10), 14);
    await db.user.update({ where: { id: userId }, data: { timezone: "UTC" } });
    await db.athleteProfile.upsert({
      where: { userId },
      create: { userId, experienceLevel: "INTERMEDIATE", weightKg: 65 },
      update: {},
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
    await post("me/ability-measurements/ftp")
      .send({ valueWatts: 250, source: "MANUAL" })
      .expect(201);
    primaryId = (
      await post("goals")
        .send({
          type: "FTP",
          description: "提升阈值功率",
          priority: "PRIMARY",
          targetDate: offset(start, 90),
          targetFtpWatts: 280,
        })
        .expect(201)
    ).body.id;
    model.generate.mockReset();
    model.generate.mockImplementation(
      async ({ messages }: { messages: { content: string }[] }) => {
        const input = JSON.parse(messages.at(-1)!.content);
        if (input.task === "生成训练目标的阶段安排草稿")
          return {
            model: "fixture",
            text: JSON.stringify({
              summary: "综合阶段",
              goalTradeoffs: ["优先阈值功率，百公里训练在恢复允许时兼顾"],
              stages: [
                {
                  title: "综合基础",
                  purpose: "阈值与耐力共同积累",
                  startDate: input.input.startDate,
                  endDate: input.input.endDate,
                  assessmentSuggestion: "一次 FTP 测试用于相关目标复评",
                },
              ],
            }),
          };
        const weeks = new Set<string>();
        const dates = (input.allowedDates as string[]).filter((day) => {
          const week = offset(day, -((new Date(day).getUTCDay() + 6) % 7));
          if (weeks.has(week)) return false;
          weeks.add(week);
          return true;
        });
        return {
          model: "fixture",
          text: JSON.stringify({
            summary: "综合课程",
            goalTradeoffs: ["以阈值为主，控制长距离训练量"],
            stageSummary: "共同规划",
            assessmentSuggestion: "统一测试",
            workouts: dates.map((date) => ({
              scheduledDate: date,
              title: "综合耐力",
              purpose: "支持主次目标",
              segments: [
                {
                  type: "work",
                  target: { kind: "duration", value: 30, unit: "min" },
                  intensity: { kind: "ftp_percent", min: 60, max: 70 },
                },
              ],
            })),
          }),
        };
      },
    );
  });
  afterAll(async () => {
    if (db) {
      await db.trainingPlan.updateMany({
        where: { userId: { in: users } },
        data: { activeVersionId: null },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });

  test("both goal entries share one confirmed roadmap, test calendar and course portfolio", async () => {
    const other = await secondary();
    const draft = await stages(other.id);
    expect(draft).toMatchObject({
      scope: "ALL_GOALS",
      goalId: primaryId,
      stale: false,
    });
    expect(draft.planningGoals.map((g: { id: string }) => g.id)).toEqual([
      primaryId,
      other.id,
    ]);
    expect(draft.goalTradeoffs).toHaveLength(1);
    const prompt = JSON.parse(
      model.generate.mock.calls.at(-1)![0].messages.at(-1).content,
    );
    expect(
      prompt.planningGoals.map((g: { priority: string }) => g.priority),
    ).toEqual(["PRIMARY", "SECONDARY"]);
    const active = (
      await post(`stage-plans/${draft.id}/activate`)
        .send({ expectedVersion: 1 })
        .expect(201)
    ).body;
    for (const id of [primaryId, other.id])
      expect(
        (await get(`goals/${id}/stage-plan`).expect(200)).body.plan.id,
      ).toBe(active.id);
    expect(
      await db.trainingStagePlan.count({ where: { userId, status: "ACTIVE" } }),
    ).toBe(1);
    const input = {
      goalId: other.id,
      stageId: active.stages[0].id,
      localDate: offset(start, 6),
      kind: "FTP",
      protocol: "设备 FTP",
    };
    const preview = (
      await post("assessments/schedule-preview").send(input).expect(201)
    ).body;
    const test = (
      await post("assessments")
        .set("Idempotency-Key", randomUUID())
        .send({
          ...input,
          previewToken: preview.token,
          acknowledgeConflicts: true,
        })
        .expect(201)
    ).body;
    expect(
      (await get("assessments").expect(200)).body.map(
        (t: { id: string }) => t.id,
      ),
    ).toEqual([test.id]);
    const completed = (
      await request(app.getHttpServer())
        .patch(`/api/v1/assessments/${test.id}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", randomUUID())
        .send({
          expectedVersion: test.version,
          status: "COMPLETED",
          protocol: test.protocol,
          actualDate: new Date().toISOString().slice(0, 10),
          resultWatts: 260,
          source: "TRAINER",
          rpe: 7,
          conditions: "同一骑行台",
        })
        .expect(200)
    ).body;
    const proposal = await courses(primaryId, 0, completed);
    expect(proposal.planningGoals.map((g: { id: string }) => g.id)).toEqual([
      primaryId,
      other.id,
    ]);
    expect(proposal.goalTradeoffs).toHaveLength(1);
    expect(
      JSON.parse(model.generate.mock.calls.at(-1)![0].messages.at(-1).content)
        .goal.id,
    ).toBe(primaryId);
    await post(`proposals/${proposal.proposalId}/validate`).expect(201);
    await post(`proposals/${proposal.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0 })
      .expect(201);
    expect(
      await db.trainingPlan.count({ where: { userId, status: "ACTIVE" } }),
    ).toBe(1);
    expect(await db.trainingAssessment.count({ where: { userId } })).toBe(1);
  });

  test("secondary edits and primary changes invalidate pending roadmaps and courses before writes", async () => {
    const other = await secondary();
    const roadmap = await stages();
    const proposal = await courses();
    await change(other.id, { description: "百公里改为两百公里" });
    expect(
      (await get(`stage-plans/${roadmap.id}`).expect(200)).body.stale,
    ).toBe(true);
    await post(`stage-plans/${roadmap.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(409);
    const validation = (
      await post(`proposals/${proposal.proposalId}/validate`).expect(201)
    ).body;
    expect(validation.blockers.join(" ")).toContain("主次顺序已变化");
    await post(`proposals/${proposal.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 0 })
      .expect(409);
    const fresh = await stages();
    await change(other.id, { priority: "PRIMARY" });
    await post(`stage-plans/${fresh.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(409);
    expect(await db.trainingPlan.count({ where: { userId } })).toBe(0);
  });

  test("legacy roadmaps stay readable and are archived only by confirmed unified replacement", async () => {
    const other = await secondary();
    const ftp = (await get("me/ability-measurements/ftp").expect(200)).body;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    for (const goalId of [primaryId, other.id])
      await db.trainingStagePlan.create({
        data: {
          userId,
          goalId,
          goalVersion: 1,
          ftpMeasurementId: ftp.id,
          availabilityVersion: 1,
          profileVersion: user.profileVersion,
          generationId: randomUUID(),
          status: "ACTIVE",
          summary: "旧单目标阶段",
          startDate: new Date(start),
          endDate: new Date(offset(start, 13)),
          model: "legacy",
          skillVersion: "1",
        },
      });
    const legacy = (await get(`goals/${other.id}/stage-plan`).expect(200)).body
      .plan;
    expect(legacy).toMatchObject({ stale: true, scope: "LEGACY_GOAL" });
    const draft = await stages();
    expect(
      await db.trainingStagePlan.count({ where: { userId, status: "ACTIVE" } }),
    ).toBe(2);
    await post(`stage-plans/${draft.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(201);
    expect(
      await db.trainingStagePlan.count({ where: { userId, status: "ACTIVE" } }),
    ).toBe(1);
    expect(
      await db.trainingStagePlan.count({
        where: { userId, status: "ARCHIVED" },
      }),
    ).toBe(2);
    expect(
      (await get(`stage-plans/${legacy.id}`).expect(200)).body.status,
    ).toBe("ARCHIVED");
  });

  test("adding a goal or changing goals during preview invalidates drafts and test confirmation", async () => {
    const roadmap = await stages();
    const proposal = await courses();
    const input = {
      goalId: primaryId,
      localDate: start,
      kind: "FTP",
      protocol: "设备 FTP",
    };
    const preview = (
      await post("assessments/schedule-preview").send(input).expect(201)
    ).body;
    await secondary();
    await post(`stage-plans/${roadmap.id}/activate`)
      .send({ expectedVersion: 1 })
      .expect(409);
    expect(
      (await post(`proposals/${proposal.proposalId}/validate`).expect(201)).body
        .status,
    ).toBe("BLOCKED");
    await post("assessments")
      .set("Idempotency-Key", randomUUID())
      .send({
        ...input,
        previewToken: preview.token,
        acknowledgeConflicts: true,
      })
      .expect(409);
    expect(await db.trainingAssessment.count({ where: { userId } })).toBe(0);
  });
});
