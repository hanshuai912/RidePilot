import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ftpMeasurementSchema } from "@ridepilot/contracts";
import { randomInt } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const path = "/api/v1/me/ability-measurements/ftp";

describeDb("FTP measurement timestamps", () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let db: PrismaService;
  let token: string;
  let userId: string;
  const users: string[] = [];
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
    users.push(response.body.user.id);
    return response.body;
  };
  const post = (input: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${token}`)
      .send(input);
  const get = (access = token) =>
    request(app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${access}`);

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
    token = auth.tokens.accessToken;
    userId = auth.user.id;
  });
  afterAll(async () => {
    if (db && users.length)
      await db.user.deleteMany({ where: { id: { in: users } } });
    await app?.close();
  });

  it.each(["MANUAL", "TEST"])(
    "uses server time when a current %s measurement omits measuredAt",
    async (source) => {
      const before = Date.now();
      const response = await post({ valueWatts: 200, source }).expect(201);
      const after = Date.now();
      const saved = ftpMeasurementSchema.parse(response.body);
      expect(Date.parse(saved.measuredAt)).toBeGreaterThanOrEqual(before);
      expect(Date.parse(saved.measuredAt)).toBeLessThanOrEqual(after);
      expect(saved).toMatchObject({ valueWatts: 200, source });
      expect((await get().expect(200)).body).toEqual(saved);
      const row = await db.abilityMeasurement.findUniqueOrThrow({
        where: { id: saved.id },
      });
      expect(row.userId).toBe(userId);
      expect(row.measuredAt.toISOString()).toBe(saved.measuredAt);
    },
  );

  it("preserves explicit historical timestamps with offsets without replacing the latest FTP", async () => {
    const current = await post({ valueWatts: 220, source: "MANUAL" }).expect(
      201,
    );
    const historical = await post({
      valueWatts: 180,
      source: "TEST",
      measuredAt: "2020-01-02T08:00:00+08:00",
    }).expect(201);
    expect(historical.body.measuredAt).toBe("2020-01-02T00:00:00.000Z");
    expect((await get().expect(200)).body).toEqual(current.body);
    expect(await db.abilityMeasurement.count({ where: { userId } })).toBe(2);
  });

  it.each([60_000, 86_400_000])(
    "rejects an explicit future date (%s ms ahead) without writing or changing the latest FTP",
    async (ahead) => {
      const current = await post({ valueWatts: 200, source: "MANUAL" }).expect(
        201,
      );
      const response = await post({
        valueWatts: 240,
        source: "MANUAL",
        measuredAt: new Date(Date.now() + ahead).toISOString(),
      }).expect(400);
      expect(response.body.code).toBe("FTP_DATE_IN_FUTURE");
      expect(await db.abilityMeasurement.count({ where: { userId } })).toBe(1);
      expect((await get().expect(200)).body).toEqual(current.body);
    },
  );

  it.each([null, "", "not-a-date"])(
    "rejects invalid explicit timestamps (%s) rather than silently using server time",
    async (measuredAt) => {
      await post({ valueWatts: 200, source: "MANUAL", measuredAt }).expect(400);
      expect(await db.abilityMeasurement.count({ where: { userId } })).toBe(0);
    },
  );

  it("requires authentication and isolates the saved measurement from other users", async () => {
    await request(app.getHttpServer())
      .post(path)
      .send({ valueWatts: 200, source: "MANUAL" })
      .expect(401);
    expect(await db.abilityMeasurement.count({ where: { userId } })).toBe(0);
    const other = await register();
    await post({ valueWatts: 200, source: "MANUAL" }).expect(201);
    // Nest returns an empty body for a null measurement.
    expect((await get(other.tokens.accessToken).expect(200)).text).toBe("");
    expect(
      await db.abilityMeasurement.count({ where: { userId: other.user.id } }),
    ).toBe(0);
  });
});
