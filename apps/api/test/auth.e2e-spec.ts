import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { authResponseSchema } from "@ridepilot/contracts";
import { randomInt } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase("auth API with PostgreSQL and Redis", () => {
  jest.setTimeout(30_000);

  let app: INestApplication;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const suffix = String(randomInt(100_000_000, 1_000_000_000));
  const phoneA = `13${suffix}`;
  const phoneB = `14${suffix}`;
  const invalidPhone = `15${suffix}`;
  const unknownPhone = `16${suffix}`;
  const password = "Ab!123";

  const registerBody = (phone: string, verificationCode = "123456") => ({
    phone,
    verificationCode,
    password,
    confirmPassword: password,
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  it("rejects invalid code, password, and confirmation without creating an account", async () => {
    for (const body of [
      { ...registerBody(invalidPhone), verificationCode: "12345" },
      {
        ...registerBody(invalidPhone),
        password: "Ab!12",
        confirmPassword: "Ab!12",
      },
      { ...registerBody(invalidPhone), confirmPassword: "different" },
    ]) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(body)
        .expect(400);
    }

    expect(
      await prisma.authCredential.count({
        where: { loginIdentifier: invalidPhone },
      }),
    ).toBe(0);
  });

  it("protects logout without a valid access token", async () => {
    await request(app.getHttpServer()).post("/api/v1/auth/logout").expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", "Bearer invalid")
      .expect(401);
  });

  it("registers, logs in, rotates refresh tokens, isolates sessions, and logs out", async () => {
    const registered = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(registerBody(phoneA))
      .expect(201);
    const accountA = authResponseSchema.parse(registered.body);
    createdUserIds.push(accountA.user.id);
    expect(accountA.user).toMatchObject({
      phone: phoneA,
      phoneVerified: false,
    });

    const credential = await prisma.authCredential.findFirstOrThrow({
      where: { userId: accountA.user.id },
    });
    expect(credential.verificationStatus).toBe("UNVERIFIED");
    expect(credential.passwordHash).not.toContain(password);

    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(registerBody(phoneA))
      .expect(409);
    expect(
      await prisma.authCredential.count({ where: { loginIdentifier: phoneA } }),
    ).toBe(1);

    const wrongPassword = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ phone: phoneA, password: "Wrong!1" })
      .expect(401);
    const unknownAccount = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ phone: unknownPhone, password: "Wrong!1" })
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownAccount.body);

    const loggedIn = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ phone: phoneA, password })
      .expect(200);
    const sessionA = authResponseSchema.parse(loggedIn.body);
    expect(sessionA.user.id).toBe(accountA.user.id);

    const second = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(registerBody(phoneB, "000000"))
      .expect(201);
    const accountB = authResponseSchema.parse(second.body);
    createdUserIds.push(accountB.user.id);
    expect(accountB.user.id).not.toBe(accountA.user.id);

    const rotated = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: sessionA.tokens.refreshToken })
      .expect(200);
    const newSessionA = authResponseSchema.parse(rotated.body);
    expect(newSessionA.tokens.refreshToken).not.toBe(
      sessionA.tokens.refreshToken,
    );

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: sessionA.tokens.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${newSessionA.tokens.accessToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${newSessionA.tokens.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: newSessionA.tokens.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accountB.tokens.accessToken}`)
      .expect(204);
  });

  it("allows only one concurrent refresh and rate limits repeated login attempts", async () => {
    const registered = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(registerBody(`17${suffix}`, "999999"))
      .expect(201);
    const account = authResponseSchema.parse(registered.body);
    createdUserIds.push(account.user.id);

    const results = await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: account.tokens.refreshToken }),
      request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: account.tokens.refreshToken }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 401]);

    const rateLimitPhone = `18${suffix}`;
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ phone: rateLimitPhone, password: "Wrong!1" })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ phone: rateLimitPhone, password: "Wrong!1" })
      .expect(429);
  });
});
