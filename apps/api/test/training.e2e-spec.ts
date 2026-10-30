import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  authResponseSchema,
  applyProposalResponseSchema,
  calendarResponseSchema,
  homeTodayResponseSchema,
  proposalResponseSchema,
  type ManualWorkoutDraft,
  type ProposalResponse,
} from "@ridepilot/contracts";
import { randomInt } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase("manual training plan API", () => {
  jest.setTimeout(30_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let token: string;
  const userIds: string[] = [];
  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const draft = (
    overrides: Partial<ManualWorkoutDraft> = {},
  ): ManualWorkoutDraft => ({
    scheduledDate: today(),
    title: "人工骑行",
    purpose: "基础耐力",
    segments: [
      {
        type: "work",
        target: { kind: "duration", value: 30, unit: "min" },
        intensity: { kind: "power_watt", min: 100, max: 150 },
      },
    ],
    ...overrides,
  });
  const post = (path: string, accessToken = token) =>
    request(app.getHttpServer())
      .post(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${accessToken}`);
  const get = (path: string, accessToken = token) =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${accessToken}`);
  const patch = (id: string, body: object, accessToken = token) =>
    request(app.getHttpServer())
      .patch(`/api/v1/proposals/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
  const create = async (input = draft()) =>
    proposalResponseSchema.parse(
      (await post("workouts/manual-proposals").send(input).expect(201)).body,
    );
  const ready = async (proposal: ProposalResponse) =>
    proposalResponseSchema.parse(
      (await post(`proposals/${proposal.proposalId}/validate`).expect(201))
        .body,
    );
  const apply = (
    proposal: ProposalResponse,
    key = proposal.proposalId,
    expectedBaseVersion = proposal.basePlanVersion,
  ) =>
    post(`proposals/${proposal.proposalId}/apply`)
      .set("Idempotency-Key", key)
      .send({ expectedBaseVersion });
  const calendar = async () =>
    calendarResponseSchema.parse(
      (await get(`calendar?from=${today()}&to=2099-12-31`).expect(200)).body,
    );
  const register = async () => {
    const phone = `19${randomInt(100_000_000, 1_000_000_000)}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        phone,
        verificationCode: "123456",
        password: "Ab!123",
        confirmPassword: "Ab!123",
      })
      .expect(201);
    const auth = authResponseSchema.parse(response.body);
    userIds.push(auth.user.id);
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { timezone: "Asia/Shanghai" },
    });
    return auth;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    const auth = await register();
    userId = auth.user.id;
    token = auth.tokens.accessToken;
    await prisma.abilityMeasurement.create({
      data: {
        userId,
        metricType: "FTP",
        value: 250,
        unit: "W",
        source: "MANUAL",
        measuredAt: new Date(),
      },
    });
  });
  afterAll(async () => {
    // Break the active-version reference before cascading test fixtures.
    if (prisma && userIds.length) {
      await prisma.trainingPlan.updateMany({
        where: { userId: { in: userIds } },
        data: { activeVersionId: null },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app?.close();
  });

  it("home aggregates the current user's day in one authenticated response", async () => {
    await request(app.getHttpServer()).get("/api/v1/home/today").expect(401);
    const empty = homeTodayResponseSchema.parse(
      (await get("home/today").expect(200)).body,
    );
    expect(empty.localDate).toBe(today());
    expect(empty.profile.userId).toBe(userId);
    expect(empty.training).toMatchObject({
      status: "READY",
      data: {
        plan: { hasActivePlan: false, planVersion: 0 },
        calendar: { items: [] },
        nextWorkout: null,
      },
    });
    expect(empty.nutrition).toMatchObject({
      status: "READY",
      data: { from: today(), to: today(), status: "NOT_GENERATED" },
    });
    const first = await create();
    await ready(first);
    await apply(first).expect(201);
    const result = homeTodayResponseSchema.parse(
      (await get("home/today").expect(200)).body,
    );
    expect(result.training).toMatchObject({
      status: "READY",
      data: {
        plan: { hasActivePlan: true, planVersion: 1 },
        calendar: { items: [{ title: "人工骑行", planVersion: 1 }] },
        nextWorkout: { title: "人工骑行", planVersion: 1 },
      },
    });
    const other = await register();
    const isolated = homeTodayResponseSchema.parse(
      (
        await get(
          `home/today?userId=${userId}&date=2099-01-01`,
          other.tokens.accessToken,
        ).expect(200)
      ).body,
    );
    expect(isolated.profile.userId).toBe(other.user.id);
    expect(isolated.localDate).toBe(today());
    expect(isolated.training).toMatchObject({
      status: "READY",
      data: { plan: { hasActivePlan: false }, calendar: { items: [] } },
    });
  });

  it("returns an authenticated, owner-scoped next course or null, ordered by date and day order", async () => {
    await request(app.getHttpServer()).get("/api/v1/workouts/next").expect(401);
    expect((await get("workouts/next").expect(200)).body.workout).toBeNull();
    const first = await create();
    await ready(first);
    await apply(first).expect(201);
    const second = await create(draft({ title: "第二节" }));
    await ready(second);
    await apply(second).expect(201);
    const items = (await calendar()).items;
    const next = (await get("workouts/next").expect(200)).body.workout;
    expect(next).toMatchObject({
      id: items[0].id,
      dayOrder: 1,
      editable: true,
      activity: null,
    });
    const other = await register();
    expect(
      (await get("workouts/next", other.tokens.accessToken).expect(200)).body
        .workout,
    ).toBeNull();
    await post("activities")
      .send({ workoutId: next.id, localDate: today(), status: "SKIPPED" })
      .expect(201);
    expect((await get("workouts/next").expect(200)).body.workout.id).toBe(
      items[1].id,
    );
    await post("activities")
      .send({
        workoutId: items[1].id,
        localDate: today(),
        status: "COMPLETED",
        durationMin: 30,
      })
      .expect(201);
    expect((await get("workouts/next").expect(200)).body.workout).toBeNull();
  });

  it("preserves actual records across plan snapshots and rejects repeated feedback or editing recorded courses", async () => {
    const first = await create();
    await ready(first);
    await apply(first).expect(201);
    const original = (await calendar()).items[0];
    await post("activities")
      .send({
        workoutId: original.id,
        localDate: today(),
        status: "PARTIAL",
        durationMin: 20,
        rpe: 7,
        fatigue: 6,
        notes: "最后一组未完成",
      })
      .expect(201);
    const second = await create(draft({ title: "第二节" }));
    await ready(second);
    await apply(second).expect(201);
    const copied = (await calendar()).items[0];
    expect(copied.id).not.toBe(original.id);
    expect(copied).toMatchObject({
      editable: false,
      activity: {
        status: "PARTIAL",
        durationMin: 20,
        rpe: 7,
        notes: "最后一组未完成",
      },
    });
    expect(
      (await get(`workouts/${copied.id}`).expect(200)).body.activity,
    ).toEqual(copied.activity);
    await get(`workouts/${original.id}`).expect(404);
    await post("activities")
      .send({ workoutId: copied.id, localDate: today(), status: "COMPLETED" })
      .expect(409);
    await post(`workouts/${copied.id}/edit-proposal`)
      .send({ ...draft(), expectedPlanVersion: 2 })
      .expect(409);
    expect(await prisma.trainingActivity.count({ where: { userId } })).toBe(1);
    expect((await get("workouts/next").expect(200)).body.workout.dayOrder).toBe(
      2,
    );
  });

  it("feedback submitted after draft validation prevents publication without changing the active plan", async () => {
    const first = await create();
    await ready(first);
    await apply(first).expect(201);
    const original = (await calendar()).items[0];
    const edit = proposalResponseSchema.parse(
      (
        await post(`workouts/${original.id}/edit-proposal`)
          .send({ ...draft({ title: "待确认修改" }), expectedPlanVersion: 1 })
          .expect(201)
      ).body,
    );
    await ready(edit);
    await post("activities")
      .send({ workoutId: original.id, localDate: today(), status: "COMPLETED" })
      .expect(201);
    await apply(edit).expect(409);
    const current = (await calendar()).items[0];
    expect(current).toMatchObject({
      id: original.id,
      title: "人工骑行",
      planVersion: 1,
      activity: { status: "COMPLETED" },
    });
    expect(
      await prisma.planVersion.count({ where: { plan: { userId } } }),
    ).toBe(1);
  });

  it("saves, reads, edits and validates the first draft without publishing until confirmation", async () => {
    const proposal = await create();
    expect(proposal).toMatchObject({
      basePlanVersion: 0,
      status: "DRAFT",
      originalWorkout: null,
    });
    expect(proposal.draftWorkout).toMatchObject({
      planVersion: 1,
      dayOrder: 1,
      scheduledDate: today(),
    });
    expect(
      (await get(`proposals/${proposal.proposalId}`).expect(200)).body
        .basePlanVersion,
    ).toBe(0);
    const updated = proposalResponseSchema.parse(
      (
        await patch(proposal.proposalId, {
          expectedProposalVersion: 1,
          draft: draft({ title: "首次人工计划" }),
        }).expect(200)
      ).body,
    );
    await patch(proposal.proposalId, {
      expectedProposalVersion: 1,
      draft: draft(),
    }).expect(409);
    expect((await ready(updated)).status).toBe("READY");
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    expect((await calendar()).items).toEqual([]);

    const results = await Promise.all([apply(updated), apply(updated)]);
    results.forEach((response) => expect(response.status).toBe(201));
    expect(results[1].body).toEqual(results[0].body);
    expect(applyProposalResponseSchema.parse(results[0].body)).toEqual({
      success: true,
      newPlanVersion: 1,
      affectedDates: [today()],
    });
    expect(
      await prisma.trainingPlan.count({ where: { userId, status: "ACTIVE" } }),
    ).toBe(1);
    expect(
      await prisma.planVersion.count({ where: { plan: { userId } } }),
    ).toBe(1);
    expect(
      await prisma.planItem.count({
        where: { planVersion: { plan: { userId } } },
      }),
    ).toBe(1);
    const items = (await calendar()).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "首次人工计划",
      source: "manual",
      planVersion: 1,
      dayOrder: 1,
    });
    expect((await get(`workouts/${items[0].id}`).expect(200)).body).toEqual(
      items[0],
    );
    expect(
      (await post(`proposals/${proposal.proposalId}/validate`).expect(409)).body
        .code,
    ).toBe("PROPOSAL_NOT_EDITABLE");
    await patch(proposal.proposalId, {
      expectedProposalVersion: 2,
      draft: draft(),
    }).expect(409);
  });

  it("adds and edits courses using new versions while calendar excludes historical copies", async () => {
    const first = await ready(await create());
    await apply(first).expect(201);
    const original = (await calendar()).items[0];
    const second = await ready(await create(draft({ title: "第二节" })));
    expect(second.basePlanVersion).toBe(1);
    await apply(second).expect(201);
    const items = (await calendar()).items;
    expect(items.map((item) => item.dayOrder)).toEqual([1, 2]);
    expect(items.map((item) => item.planVersion)).toEqual([2, 2]);
    await get(`workouts/${original.id}`).expect(404);
    const edit = proposalResponseSchema.parse(
      (
        await post(`workouts/${items[0].id}/edit-proposal`)
          .send({ ...draft({ title: "修改第一节" }), expectedPlanVersion: 2 })
          .expect(201)
      ).body,
    );
    await ready(edit);
    // Returning from preview to edit resets validation and retains the base version.
    const updated = proposalResponseSchema.parse(
      (
        await patch(edit.proposalId, {
          expectedProposalVersion: 1,
          draft: draft({ title: "确认修改第一节" }),
        }).expect(200)
      ).body,
    );
    expect(updated.status).toBe("DRAFT");
    await apply(updated).expect(409);
    await ready(updated);
    await apply(updated).expect(201);
    const current = (await calendar()).items;
    expect(
      current.map((item) => [item.title, item.dayOrder, item.planVersion]),
    ).toEqual([
      ["确认修改第一节", 1, 3],
      ["第二节", 2, 3],
    ]);
    const stale = await post(`workouts/${current[0].id}/edit-proposal`)
      .send({ ...draft(), expectedPlanVersion: 2 })
      .expect(409);
    expect(stale.body.code).toBe("PLAN_VERSION_CONFLICT");
  });

  it("serializes concurrent initial proposals and keeps the losing draft unapplied", async () => {
    const a = await ready(await create());
    const b = await ready(await create());
    const results = await Promise.all([apply(a), apply(b)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe(
      "PLAN_VERSION_CONFLICT",
    );
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(1);
    expect(
      await prisma.planVersion.count({ where: { plan: { userId } } }),
    ).toBe(1);
    expect(
      await prisma.changeProposal.count({
        where: { userId, status: "APPLIED" },
      }),
    ).toBe(1);
    expect((await calendar()).items).toHaveLength(1);
  });

  it("rejects invalid, unvalidated and incorrectly versioned initial submissions without creating a plan", async () => {
    await post("workouts/manual-proposals")
      .send(draft({ segments: [] }))
      .expect(400);
    await post("workouts/manual-proposals")
      .send(draft({ scheduledDate: "2000-01-01" }))
      .expect(409);
    await prisma.abilityMeasurement.deleteMany({ where: { userId } });
    await post("workouts/manual-proposals")
      .send(
        draft({
          segments: [
            {
              type: "work",
              target: { kind: "duration", value: 10, unit: "min" },
              intensity: { kind: "ftp_percent", min: 80, max: 90 },
            },
          ],
        }),
      )
      .expect(400);
    await prisma.abilityMeasurement.create({
      data: {
        userId,
        metricType: "FTP",
        value: 250,
        unit: "W",
        source: "MANUAL",
        measuredAt: new Date(),
      },
    });
    const proposal = await create();
    expect((await apply(proposal).expect(409)).body.code).toBe(
      "PROPOSAL_NOT_READY",
    );
    await ready(proposal);
    await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedBaseVersion: 0 })
      .expect(409);
    expect(
      (await apply(proposal, proposal.proposalId, 1).expect(409)).body.code,
    ).toBe("PLAN_VERSION_CONFLICT");
    await apply(proposal, proposal.proposalId, -1).expect(400);
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    expect((await calendar()).items).toEqual([]);
  });

  it("rechecks FTP at confirmation and allows the blocked initial draft to be corrected", async () => {
    await prisma.abilityMeasurement.create({
      data: {
        userId,
        metricType: "FTP",
        value: 250,
        unit: "W",
        source: "manual",
        measuredAt: new Date(),
      },
    });
    const proposal = await ready(
      await create(
        draft({
          segments: [
            {
              type: "work",
              target: { kind: "duration", value: 10, unit: "min" },
              intensity: { kind: "ftp_percent", min: 80, max: 90 },
            },
          ],
        }),
      ),
    );
    await prisma.abilityMeasurement.deleteMany({ where: { userId } });
    expect((await apply(proposal).expect(400)).body.code).toBe("FTP_REQUIRED");
    expect(await prisma.trainingPlan.count({ where: { userId } })).toBe(0);
    expect((await ready(proposal)).status).toBe("BLOCKED");
    await prisma.abilityMeasurement.create({
      data: {
        userId,
        metricType: "FTP",
        value: 250,
        unit: "W",
        source: "MANUAL",
        measuredAt: new Date(),
      },
    });
    const updated = proposalResponseSchema.parse(
      (
        await patch(proposal.proposalId, {
          expectedProposalVersion: 1,
          draft: draft(),
        }).expect(200)
      ).body,
    );
    expect(updated.basePlanVersion).toBe(0);
    await ready(updated);
    await apply(updated).expect(201);
  });

  it("isolates proposals, workouts and calendar by authenticated owner", async () => {
    const proposal = await ready(await create());
    await apply(proposal).expect(201);
    const workout = (await calendar()).items[0];
    const other = await register();
    const otherToken = other.tokens.accessToken;
    await get(`proposals/${proposal.proposalId}`, otherToken).expect(404);
    await post(`proposals/${proposal.proposalId}/validate`, otherToken).expect(
      404,
    );
    await patch(
      proposal.proposalId,
      { expectedProposalVersion: 1, draft: draft() },
      otherToken,
    ).expect(404);
    await post(`proposals/${proposal.proposalId}/apply`, otherToken)
      .set("Idempotency-Key", "foreign-proposal")
      .send({ expectedBaseVersion: 0 })
      .expect(404);
    await get(`workouts/${workout.id}`, otherToken).expect(404);
    await post(`workouts/${workout.id}/edit-proposal`, otherToken)
      .send({ ...draft(), expectedPlanVersion: 1 })
      .expect(404);
    expect(
      (
        await get(`calendar?from=${today()}&to=2099-12-31`, otherToken).expect(
          200,
        )
      ).body.items,
    ).toEqual([]);
    await request(app.getHttpServer())
      .post("/api/v1/workouts/manual-proposals")
      .send(draft())
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/proposals/${proposal.proposalId}/apply`)
      .set("Idempotency-Key", "no-auth")
      .send({ expectedBaseVersion: 0 })
      .expect(401);
  });

  it("rejects reused keys and stale subsequent proposals without partially publishing", async () => {
    const first = await ready(await create());
    await apply(first).expect(201);
    const a = await ready(await create());
    const b = await ready(await create());
    expect((await apply(a, first.proposalId).expect(409)).body.code).toBe(
      "IDEMPOTENCY_KEY_CONFLICT",
    );
    expect(
      await prisma.planVersion.count({ where: { plan: { userId } } }),
    ).toBe(1);
    await apply(a).expect(201);
    expect((await apply(b).expect(409)).body.code).toBe(
      "PLAN_VERSION_CONFLICT",
    );
    expect(
      await prisma.planVersion.count({ where: { plan: { userId } } }),
    ).toBe(2);
    expect((await calendar()).items).toHaveLength(2);
  });
});
