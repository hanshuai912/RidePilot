import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  authResponseSchema,
  heartRateReadSchema,
  heartRateResponseSchema,
} from "@ridepilot/contracts";
import { randomInt } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;
describeWithDatabase("heart rate settings API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const users: { id: string; token: string }[] = [];
  const settings = {
    method: "MAX",
    maxHeartRate: 200,
    restingHeartRate: 60,
    lactateThresholdHeartRate: 180,
    expectedVersion: 0,
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    for (let i = 0; i < 2; i++) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          phone: `19${randomInt(100_000_000, 999_999_999)}`,
          verificationCode: "123456",
          password: "Ab!123",
          confirmPassword: "Ab!123",
        })
        .expect(201);
      const auth = authResponseSchema.parse(response.body);
      users.push({ id: auth.user.id, token: auth.tokens.accessToken });
    }
  });
  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
    await app?.close();
  });
  const read = (index = 0) =>
    request(app.getHttpServer())
      .get("/api/v1/me/heart-rate-settings")
      .set("Authorization", `Bearer ${users[index]!.token}`);
  const save = (body: object, index = 0) =>
    request(app.getHttpServer())
      .put("/api/v1/me/heart-rate-settings")
      .set("Authorization", `Bearer ${users[index]!.token}`)
      .send(body);

  it("authenticates reads and writes and returns a real empty JSON state", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/me/heart-rate-settings")
      .expect(401);
    await request(app.getHttpServer())
      .put("/api/v1/me/heart-rate-settings")
      .send(settings)
      .expect(401);
    const result = await read().expect(200);
    expect(heartRateReadSchema.parse(result.body)).toEqual({ settings: null });
  });
  it("persists settings, isolates users, and deduplicates simultaneous first saves", async () => {
    const responses = await Promise.all([save(settings), save(settings)]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(heartRateResponseSchema.parse(response.body)).toMatchObject({
        version: 1,
        ruleVersion: 1,
        maxHeartRate: 200,
      });
    }
    expect((await read().expect(200)).body.settings).toMatchObject({
      version: 1,
      maxHeartRate: 200,
    });
    expect((await read(1).expect(200)).body).toEqual({ settings: null });
    expect(
      await prisma.heartRateSettings.count({ where: { userId: users[0]!.id } }),
    ).toBe(1);
  });
  it("retains all heart rates when switching method and detects stale overwrites", async () => {
    await save({ ...settings, method: "RESERVE", expectedVersion: 1 }).expect(
      200,
    );
    const result = await save({
      ...settings,
      method: "LTHR",
      expectedVersion: 2,
    }).expect(200);
    expect(result.body).toMatchObject({
      method: "LTHR",
      maxHeartRate: 200,
      restingHeartRate: 60,
      lactateThresholdHeartRate: 180,
      version: 3,
    });
    expect((await read().expect(200)).body.settings).toEqual(result.body);
    const retry = await save({
      ...settings,
      method: "LTHR",
      expectedVersion: 2,
    }).expect(200);
    expect(retry.body).toEqual(result.body);
    await save({ ...settings, maxHeartRate: 190, expectedVersion: 1 }).expect(
      409,
    );
    expect((await read().expect(200)).body.settings.version).toBe(3);
  });
  it("allows only one competing update and checks database constraints", async () => {
    const results = await Promise.all([
      save({ ...settings, maxHeartRate: 201, expectedVersion: 3 }),
      save({ ...settings, maxHeartRate: 202, expectedVersion: 3 }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    await expect(
      prisma.heartRateSettings.update({
        where: { userId: users[0]!.id },
        data: { maxHeartRate: 999 },
      }),
    ).rejects.toThrow();
    expect((await read().expect(200)).body.settings.version).toBe(4);
  });
  it("rejects malformed values, missing inputs, and ownership overrides", async () => {
    for (const patch of [
      { userId: users[1]!.id },
      { method: "OTHER" },
      { maxHeartRate: 251 },
      { method: "LTHR", lactateThresholdHeartRate: null },
      { restingHeartRate: 200 },
      { expectedVersion: undefined },
    ]) {
      await save({ ...settings, expectedVersion: 4, ...patch }).expect(400);
    }
    expect((await read(1).expect(200)).body.settings).toBeNull();
  });
});
