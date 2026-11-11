import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  authResponseSchema,
  trainingHistoryResponseSchema,
} from "@ridepilot/contracts";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;
describeWithDatabase("training history", () => {
  jest.setTimeout(30_000);
  let app: INestApplication;
  let db: PrismaService;
  let userId: string;
  let token: string;
  const users: string[] = [];
  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Pacific/Kiritimati",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const date = (offset: number) =>
    new Date(new Date(`${today()}T00:00:00Z`).getTime() + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const get = (path: string, auth = token) =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${auth}`);
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
    const auth = authResponseSchema.parse(response.body);
    users.push(auth.user.id);
    await db.user.update({
      where: { id: auth.user.id },
      data: { timezone: "Pacific/Kiritimati" },
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
    db = app.get(PrismaService);
  });
  beforeEach(async () => {
    const auth = await register();
    userId = auth.user.id;
    token = auth.tokens.accessToken;
  });
  afterAll(async () => {
    if (db && users.length) {
      await db.trainingPlan.updateMany({
        where: { userId: { in: users } },
        data: { activeVersionId: null },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });
  const plan = () =>
    db.trainingPlan.create({ data: { userId, status: "ACTIVE" } });
  const version = (planId: string, versionNo: number) =>
    db.planVersion.create({
      data: { planId, versionNo, appliedAt: new Date() },
    });
  const workout = (
    planVersionId: string,
    offset: number,
    dayOrder = 1,
    identity?: string,
  ) =>
    db.workout.create({
      data: {
        id: randomUUID(),
        planVersionId,
        sportType: "cycling",
        source: "manual",
        title: `历史课程 ${offset}/${dayOrder}`,
        scheduledDate: new Date(`${date(offset)}T00:00:00Z`),
        dayOrder,
        timeTargetMin: 30,
        structure: {
          ftpSnapshotWatts: 200,
          ...(identity ? { activityWorkoutId: identity } : {}),
          segments: [
            {
              type: "work",
              target: { kind: "duration", value: 30, unit: "min" },
              intensity: { kind: "ftp_percent", min: 60, max: 70 },
            },
          ],
        },
      },
    });

  it("sorts descending by account date, preserves recorded originals and deduplicates current copies", async () => {
    const p = await plan(),
      v1 = await version(p.id, 1),
      v2 = await version(p.id, 2);
    const original = await workout(v1.id, -1);
    const removed = await workout(v1.id, -100);
    await workout(v1.id, -2);
    await db.trainingActivity.createMany({
      data: [
        {
          userId,
          workoutId: original.id,
          localDate: original.scheduledDate,
          status: "SKIPPED",
          durationMin: 0,
        },
        {
          userId,
          workoutId: removed.id,
          localDate: removed.scheduledDate,
          status: "PARTIAL",
          durationMin: 15,
          notes: "旧版本记录",
        },
      ],
    });
    const copy = await workout(v2.id, -1, 1, original.id);
    const sameDay = await workout(v2.id, -1, 2);
    const current = await workout(v2.id, 0);
    await workout(v2.id, 1);
    await db.trainingPlan.update({
      where: { id: p.id },
      data: { activeVersionId: v2.id },
    });
    const page = trainingHistoryResponseSchema.parse(
      (await get("workouts/history").expect(200)).body,
    );
    expect(page.localDate).toBe(today());
    expect(page.timezone).toBe("Pacific/Kiritimati");
    expect(page.items.map((w) => w.id)).toEqual([
      current.id,
      copy.id,
      sameDay.id,
      removed.id,
    ]);
    expect(page.items[1]).toMatchObject({
      editable: false,
      ftpSnapshotWatts: 200,
      activity: { status: "SKIPPED", durationMin: 0 },
    });
    expect(page.items[3]).toMatchObject({ activity: { notes: "旧版本记录" } });
    expect(page.nextCursor).toBeNull();
    await get(`workouts/${removed.id}`).expect(404);
    expect(
      (await get(`workouts/history/${removed.id}`).expect(200)).body,
    ).toMatchObject({
      id: removed.id,
      editable: false,
      activity: { status: "PARTIAL" },
    });
  });

  it("paginates stable same-day ordering beyond 84 days without missing or repeating courses", async () => {
    const p = await plan(),
      v = await version(p.id, 1);
    const ids: string[] = [];
    for (let i = 1; i <= 23; i++) ids.push((await workout(v.id, -120, i)).id);
    await db.trainingPlan.update({
      where: { id: p.id },
      data: { activeVersionId: v.id },
    });
    const first = trainingHistoryResponseSchema.parse(
      (await get("workouts/history").expect(200)).body,
    );
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBeTruthy();
    const second = trainingHistoryResponseSchema.parse(
      (await get(`workouts/history?cursor=${first.nextCursor}`).expect(200))
        .body,
    );
    expect(second.items).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((w) => w.id)).toEqual(ids);
  });

  it("isolates list and detail by owner and rejects future, unpublished and unrecorded retired courses", async () => {
    const p = await plan(),
      v = await version(p.id, 1),
      old = await version(p.id, 2);
    const own = await workout(v.id, -1),
      future = await workout(v.id, 1),
      retired = await workout(old.id, -2);
    await db.trainingPlan.update({
      where: { id: p.id },
      data: { activeVersionId: v.id },
    });
    const unpublished = await db.planVersion.create({
      data: { planId: p.id, versionNo: 3 },
    });
    const draft = await workout(unpublished.id, -3);
    const other = await register();
    expect(
      (await get("workouts/history", other.tokens.accessToken).expect(200)).body
        .items,
    ).toEqual([]);
    await get(`workouts/history/${own.id}`, other.tokens.accessToken).expect(
      404,
    );
    await get(`workouts/history/${future.id}`).expect(404);
    await get(`workouts/history/${retired.id}`).expect(404);
    await get(`workouts/history/${draft.id}`).expect(404);
    await get("workouts/history/not-a-uuid").expect(404);
    expect(
      (await get(`workouts/history/${own.id}`).expect(200)).body.editable,
    ).toBe(false);
  });

  it("requires authentication, validates cursors and returns an empty page for a new account", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/workouts/history")
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/workouts/history/${randomUUID()}`)
      .expect(401);
    const page = (await get("workouts/history").expect(200)).body;
    expect(page).toMatchObject({ items: [], nextCursor: null });
    for (const cursor of [
      "",
      "!invalid",
      "a".repeat(600),
      Buffer.from(
        JSON.stringify({ date: "2030-02-30", dayOrder: -1, id: randomUUID() }),
      ).toString("base64url"),
    ]) {
      expect(
        (
          await get(
            `workouts/history?cursor=${encodeURIComponent(cursor)}`,
          ).expect(400)
        ).body.code,
      ).toBe("INVALID_HISTORY_CURSOR");
    }
  });
});
