import { trainingDateSignatures } from "../src/modules/nutrition/training-nutrition-context";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import type { PlanImpactPreview } from "@ridepilot/contracts";
import { AiService } from "../src/ai/ai.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { trainingInputSnapshot } from "../src/modules/training/training-input-snapshot";
import { activityWorkoutId } from "../src/modules/training/workout-activity";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
describeDb("saved training inputs and future plan decisions", () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let db: PrismaService;
  let token: string;
  let userId: string;
  let goalId: string;
  let start: string;
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
  const preview = async (): Promise<PlanImpactPreview> =>
    (await get("plans/input-impact").expect(200)).body;
  const reference = (p: PlanImpactPreview, end = addDays(start, 13)) => ({
    fingerprint: p.fingerprint,
    startDate: start,
    endDate: end,
  });
  const ftp = (valueWatts: number) =>
    post("me/ability-measurements/ftp")
      .send({
        valueWatts,
        source: "MANUAL",
      })
      .expect(201);
  const workout = (date: string) => ({
    scheduledDate: date,
    title: "原课程",
    purpose: "基础耐力",
    segments: [
      {
        type: "work",
        target: { kind: "duration", value: 30, unit: "min" },
        intensity: { kind: "ftp_percent", min: 70, max: 70 },
      },
      {
        type: "cooldown",
        target: { kind: "duration", value: 5, unit: "min" },
        intensity: { kind: "power_watt", min: 100, max: 100 },
      },
    ],
  });
  const createWorkout = async (date: string, version: number) => {
    const p = (
      await post("workouts/manual-proposals").send(workout(date)).expect(201)
    ).body;
    await post(`proposals/${p.proposalId}/validate`).expect(201);
    await post(`proposals/${p.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: version })
      .expect(201);
  };
  const decide = async (
    action: "KEEP" | "FTP_RECALCULATE",
    p: PlanImpactPreview,
    end?: string,
  ) =>
    (
      await post("plans/input-impact/decisions")
        .set("Idempotency-Key", randomUUID())
        .send({ ...reference(p, end), action })
        .expect(201)
    ).body;
  const wait = async (id: string) => {
    for (let i = 0; i < 80; i++) {
      const j = (await get(`ai-coach/generations/${id}`).expect(200)).body;
      if (["READY", "FAILED"].includes(j.status)) return j;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("generation timeout");
  };
  const active = () =>
    db.trainingPlan.findFirstOrThrow({
      where: { userId, status: "ACTIVE" },
      include: {
        activeVersion: {
          include: { workouts: { orderBy: { scheduledDate: "asc" } } },
        },
      },
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
    start = addDays(new Date().toISOString().slice(0, 10), 15);
    await db.athleteProfile.create({
      data: { userId, experienceLevel: "INTERMEDIATE" },
    });
    await ftp(200);
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
          description: "耐力提升",
          priority: "PRIMARY",
          targetDate: addDays(start, 180),
        })
        .expect(201)
    ).body.id;
    await createWorkout(start, 0);
    await createWorkout(addDays(start, 7), 1);
    model.generate.mockReset();
    model.generate.mockImplementation(
      async (input: { messages: { content: string }[] }) => {
        const payload = JSON.parse(input.messages.at(-1)!.content);
        const seen = new Set<string>();
        const dates = (payload.allowedDates as string[]).filter((date) => {
          const week = addDays(date, -((new Date(date).getUTCDay() + 6) % 7));
          if (seen.has(week)) return false;
          seen.add(week);
          return true;
        });
        return {
          model: "mock-impact",
          text: JSON.stringify({
            summary: "根据最新资料重排",
            stageSummary: "耐力",
            assessmentSuggestion: "后续复评",
            workouts: dates.map((d) => ({ ...workout(d), title: "新课程" })),
          }),
        };
      },
    );
  });
  afterAll(async () => {
    if (db) {
      await db.nutritionPlan.updateMany({
        where: { userId: { in: users } },
        data: { activeVersionId: null },
      });
      await db.trainingPlan.updateMany({
        where: { userId: { in: users } },
        data: { activeVersionId: null },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });

  it("stage warnings handle missing titles and identify the changed basis without false positives", async () => {
    const inputs = await trainingInputSnapshot(db, userId);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const goal = await db.trainingGoal.update({
      where: { id: goalId },
      data: { description: null },
    });
    await db.trainingStagePlan.create({
      data: {
        userId,
        goalId,
        goalVersion: goal.version,
        ftpMeasurementId: inputs.ftp!.id,
        availabilityVersion: inputs.availability!.version,
        profileVersion: user.profileVersion,
        generationId: randomUUID(),
        status: "ACTIVE",
        summary: "耐力阶段",
        startDate: new Date(start),
        endDate: new Date(addDays(start, 13)),
        model: "test",
        skillVersion: "test",
      },
    });
    expect((await preview()).stageMessages).toEqual([]);
    await ftp(220);
    const expected =
      "提升耐力：阶段依据已变化（FTP），请到训练目标复评或重新生成阶段。阶段测试须单独核对。";
    expect((await preview()).stageMessages).toEqual([expected]);
    await db.trainingGoal.update({
      where: { id: goalId },
      data: { description: "   " },
    });
    expect((await preview()).stageMessages).toEqual([expected]);
    await db.trainingGoal.update({
      where: { id: goalId },
      data: { description: "长距离目标", version: { increment: 1 } },
    });
    await db.user.update({
      where: { id: userId },
      data: { profileVersion: { increment: 1 } },
    });
    expect((await preview()).stageMessages).toEqual([
      "长距离目标：阶段依据已变化（训练目标、FTP、运动资料），请到训练目标复评或重新生成阶段。阶段测试须单独核对。",
    ]);
  });

  it("saving FTP preserves official watts and previews 200→220 with absolute watts unchanged", async () => {
    expect((await preview()).pendingCount).toBe(0);
    await ftp(220);
    const p = await preview();
    expect(p.pendingCount).toBe(2);
    expect(p.items[0].issues).toEqual(["FTP"]);
    expect(p.items[0].power[0]).toEqual({
      before: "70–70% FTP · 140–140 W",
      after: "70–70% FTP · 154–154 W",
    });
    expect(p.items[0].power[1].before).toBe(p.items[0].power[1].after);
    const current = await active();
    expect(current.activeVersion!.versionNo).toBe(2);
    expect(
      (
        current.activeVersion!.workouts[0].structure as {
          ftpSnapshotWatts: number;
        }
      ).ftpSnapshotWatts,
    ).toBe(200);
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("manual edits keep the course FTP basis until the user explicitly recalculates", async () => {
    await ftp(220);
    const old = (await active()).activeVersion!.workouts[0];
    const draft = (
      await post(`workouts/${old.id}/edit-proposal`)
        .send({
          ...workout(start),
          title: "改名后的课程",
          expectedPlanVersion: 2,
        })
        .expect(201)
    ).body;
    await post(`proposals/${draft.proposalId}/validate`).expect(201);
    await post(`proposals/${draft.proposalId}/apply`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedBaseVersion: 2 })
      .expect(201);
    const changed = (await preview()).items.find(
      (i) => i.workout.title === "改名后的课程",
    )!;
    expect(changed.oldFtpWatts).toBe(200);
    expect(changed.issues).toContain("FTP");
    expect(changed.power[0].before).toContain("140–140 W");
  });

  it("KEEP is idempotent, scoped, durable across plan copies and leaves official version unchanged", async () => {
    await ftp(220);
    const p = await preview();
    const input = { ...reference(p, start), action: "KEEP" };
    const key = randomUUID();
    const results = await Promise.all([
      post("plans/input-impact/decisions")
        .set("Idempotency-Key", key)
        .send(input)
        .expect(201),
      post("plans/input-impact/decisions")
        .set("Idempotency-Key", key)
        .send(input)
        .expect(201),
    ]);
    expect(results[0].body.id).toBe(results[1].body.id);
    expect((await preview()).pendingCount).toBe(1);
    expect((await active()).activeVersion!.versionNo).toBe(2);
    await createWorkout(addDays(start, 2), 2);
    const after = await preview();
    expect(
      after.items.find((i) => i.workout.scheduledDate === start)!.issues,
    ).toEqual([]);
    expect(after.pendingCount).toBe(1);
    await post("plans/input-impact/decisions")
      .set("Idempotency-Key", key)
      .send({ ...input, endDate: addDays(start, 1) })
      .expect(409);
  });

  it("FTP application publishes once, retains out of range snapshots, item metadata and original versions", async () => {
    const before = await active();
    const first = before.activeVersion!.workouts[0];
    await db.planItem.update({
      where: { workoutId: first.id },
      data: { scheduledStart: new Date(`${start}T10:00:00Z`) },
    });
    const nutrition = await db.nutritionPlan.create({ data: { userId } });
    const nutritionVersion = await db.nutritionPlanVersion.create({
      data: {
        planId: nutrition.id,
        versionNo: 1,
        source: "manual",
        profileVersion: 1,
        trainingPlanVersionNo: 2,
        snapshot: {
          trainingDateSignatures: trainingDateSignatures(
            start,
            addDays(start, 7),
            before.activeVersion!.workouts,
          ),
        },
      },
    });
    await db.nutritionPlan.update({
      where: { id: nutrition.id },
      data: { activeVersionId: nutritionVersion.id },
    });
    expect(
      (
        await get(
          `nutrition/training-link?from=${start}&to=${addDays(start, 7)}`,
        ).expect(200)
      ).body.affectedDates,
    ).toEqual([]);
    await ftp(220);
    const p = await preview();
    const d = await decide("FTP_RECALCULATE", p, start);
    expect((await active()).activeVersion!.versionNo).toBe(2);
    const [a, b] = await Promise.all([
      post(`plans/input-impact/decisions/${d.id}/apply`)
        .set("Idempotency-Key", "retry")
        .expect(201),
      post(`plans/input-impact/decisions/${d.id}/apply`)
        .set("Idempotency-Key", "retry")
        .expect(201),
    ]);
    expect(a.body.newPlanVersion).toBe(3);
    expect(b.body.newPlanVersion).toBe(3);
    const after = await active();
    const [w1, w2] = after.activeVersion!.workouts;
    expect(
      (w1.structure as { ftpSnapshotWatts: number }).ftpSnapshotWatts,
    ).toBe(220);
    expect(
      (w2.structure as { ftpSnapshotWatts: number }).ftpSnapshotWatts,
    ).toBe(200);
    expect(w1.title).toBe(first.title);
    expect(w1.purpose).toBe(first.purpose);
    expect(w1.timeTargetMin).toEqual(first.timeTargetMin);
    expect((w1.structure as { segments: unknown }).segments).toEqual(
      (first.structure as { segments: unknown }).segments,
    );
    expect(
      (
        await db.planItem.findUniqueOrThrow({ where: { workoutId: w1.id } })
      ).scheduledStart?.toISOString(),
    ).toBe(`${start}T10:00:00.000Z`);
    expect(
      (await db.workout.findUniqueOrThrow({ where: { id: first.id } }))
        .structure,
    ).toEqual(first.structure);
    expect((await preview()).pendingCount).toBe(1);
    const nutritionState = (
      await get(
        `nutrition/training-link?from=${start}&to=${addDays(start, 7)}`,
      ).expect(200)
    ).body;
    expect(nutritionState.affectedDates).toEqual([start]);
    expect(nutritionState.nutritionVersion).toBe(1);
    expect(
      (
        await db.nutritionPlan.findUniqueOrThrow({
          where: { id: nutrition.id },
        })
      ).activeVersionId,
    ).toBe(nutritionVersion.id);
  });

  it("protects recorded workouts and rejects draft after a new feedback record", async () => {
    await ftp(220);
    const p = await preview();
    const d = await decide("FTP_RECALCULATE", p);
    const old = (await active()).activeVersion!.workouts[0];
    await db.trainingActivity.create({
      data: {
        userId,
        workoutId: activityWorkoutId(old),
        localDate: old.scheduledDate,
        status: "COMPLETED",
        durationMin: 35,
      },
    });
    await post(`plans/input-impact/decisions/${d.id}/apply`)
      .set("Idempotency-Key", "feedback-stale")
      .expect(409);
    const fresh = await preview();
    expect(fresh.protectedCount).toBe(1);
    expect(fresh.items).toHaveLength(1);
    const valid = await decide("FTP_RECALCULATE", fresh);
    await post(`plans/input-impact/decisions/${valid.id}/apply`)
      .set("Idempotency-Key", "valid")
      .expect(201);
    const preserved = (await active()).activeVersion!.workouts[0];
    expect(activityWorkoutId(preserved)).toBe(activityWorkoutId(old));
    expect(preserved.structure).toEqual(old.structure);
  });

  it("rejects stale facts and retained decisions; unknown old FTP cannot be guessed", async () => {
    await ftp(220);
    const p = await preview();
    const d = await decide("FTP_RECALCULATE", p);
    await decide("KEEP", p, start);
    await post(`plans/input-impact/decisions/${d.id}/apply`)
      .set("Idempotency-Key", "kept")
      .expect(409);
    const second = (await active()).activeVersion!.workouts[1];
    await db.workout.update({
      where: { id: second.id },
      data: { structure: { segments: workout(start).segments } },
    });
    const unknown = await preview();
    const item = unknown.items.find((i) => i.workout.id === second.id)!;
    expect(item.oldFtpWatts).toBeNull();
    expect(item.recalculable).toBe(false);
    await post("plans/input-impact/decisions")
      .set("Idempotency-Key", randomUUID())
      .send({
        ...reference(unknown, addDays(start, 7)),
        startDate: addDays(start, 7),
        action: "FTP_RECALCULATE",
      })
      .expect(400);
    await ftp(230);
    await post("plans/input-impact/decisions")
      .set("Idempotency-Key", randomUUID())
      .send({ ...reference(unknown), action: "KEEP" })
      .expect(409);
  });

  it("shows time conflicts and target changes without publishing, and partial FTP does not clear either", async () => {
    await ftp(220);
    await request(app.getHttpServer())
      .put("/api/v1/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "UTC",
        expectedVersion: 1,
        weekdays: [
          {
            weekday: (new Date(start).getUTCDay() + 1) % 7,
            availableMinutes: 20,
          },
        ],
        maxSessionMinutes: 20,
      })
      .expect(200);
    await db.trainingGoal.update({
      where: { id: goalId },
      data: {
        version: { increment: 1 },
        targetDate: new Date(addDays(start, 200)),
      },
    });
    const p = await preview();
    expect(p.items[0].issues).toEqual(["FTP", "AVAILABILITY", "GOAL"]);
    expect(p.items[0].messages).toContain("当前日期不可训练");
    const d = await decide("FTP_RECALCULATE", p, start);
    await post(`plans/input-impact/decisions/${d.id}/apply`)
      .set("Idempotency-Key", "power-only")
      .expect(201);
    const remaining = (await preview()).items.find(
      (i) => i.workout.scheduledDate === start,
    )!;
    expect(remaining.issues).toEqual(["AVAILABILITY", "GOAL"]);
  });

  it("replans through a durable AI draft, exposes original full details and applies only the chosen range", async () => {
    await ftp(220);
    const p = await preview();
    const j = (
      await post("plans/input-impact/generate-proposal")
        .set("Idempotency-Key", "replan")
        .send(reference(p, addDays(start, 3)))
        .expect(202)
    ).body;
    const ready = await wait(j.generationId);
    expect(ready.status).toBe("READY");
    expect((await active()).activeVersion!.versionNo).toBe(2);
    expect(
      (await preview()).generations.some((g) => g.id === j.generationId),
    ).toBe(true);
    const draft = (await get(`proposals/${ready.proposalId}`).expect(200)).body;
    expect(draft.planImpact.before[0].workout.segments).toEqual(
      workout(start).segments,
    );
    await post(`proposals/${ready.proposalId}/validate`).expect(201);
    await post(`proposals/${ready.proposalId}/apply`)
      .set("Idempotency-Key", "apply-replan")
      .send({
        expectedBaseVersion: 2,
        expectedProposalVersion: draft.proposalVersion,
      })
      .expect(201);
    const after = await preview();
    expect(after.pendingCount).toBe(1);
    expect(
      after.items
        .filter((i) => i.workout.title === "新课程")
        .every((i) => i.issues.length === 0),
    ).toBe(true);
  });

  it("blocks an AI candidate after goal changes and blocks a worker whose facts changed during generation", async () => {
    await ftp(220);
    const p = await preview();
    const j = (
      await post("plans/input-impact/generate-proposal")
        .set("Idempotency-Key", "stale-model")
        .send(reference(p))
    ).body;
    const ready = await wait(j.generationId);
    expect(ready.status).toBe("READY");
    await db.trainingGoal.update({
      where: { id: goalId },
      data: { version: { increment: 1 } },
    });
    const checked = (
      await post(`proposals/${ready.proposalId}/validate`).expect(201)
    ).body;
    expect(checked.status).toBe("BLOCKED");
    await post(`proposals/${ready.proposalId}/apply`)
      .set("Idempotency-Key", "stale-apply")
      .send({ expectedBaseVersion: 2 })
      .expect(409);
    const generate = model.generate.getMockImplementation()!;
    model.generate.mockImplementationOnce(async (input) => {
      const result = await generate(input);
      await ftp(240);
      return result;
    });
    const fresh = await preview();
    const job = (
      await post("plans/input-impact/generate-proposal")
        .set("Idempotency-Key", "changed-during-model")
        .send(reference(fresh))
    ).body;
    expect((await wait(job.generationId)).status).toBe("FAILED");
    expect((await active()).activeVersion!.versionNo).toBe(2);
  });

  it("enforces ownership, authentication, range and active-goal requirements", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/plans/input-impact")
      .expect(401);
    await ftp(220);
    const p = await preview();
    const d = await decide("FTP_RECALCULATE", p);
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
    await get(
      `plans/input-impact/decisions/${d.id}`,
      other.tokens.accessToken,
    ).expect(404);
    await post(
      `plans/input-impact/decisions/${d.id}/apply`,
      other.tokens.accessToken,
    )
      .set("Idempotency-Key", "foreign")
      .expect(404);
    await post("plans/input-impact/decisions")
      .set("Idempotency-Key", randomUUID())
      .send({ ...reference(p, addDays(start, 84)), action: "KEEP" })
      .expect(409);
    await db.trainingGoal.update({
      where: { id: goalId },
      data: { status: "PAUSED", version: { increment: 1 } },
    });
    const paused = await preview();
    expect(paused.goalId).toBeNull();
    await post("plans/input-impact/generate-proposal")
      .set("Idempotency-Key", "paused")
      .send(reference(paused))
      .expect(409);
    await decide("KEEP", paused);
    expect((await trainingInputSnapshot(db, userId)).ftp!.valueWatts).toBe(220);
  });
});
