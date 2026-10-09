import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  authResponseSchema,
  profileResponseSchema,
} from "@ridepilot/contracts";
import { randomInt } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase("profile API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();

    const phone = `19${randomInt(100_000_000, 999_999_999)}`;
    const registered = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        phone,
        verificationCode: "123456",
        password: "Ab!123",
        confirmPassword: "Ab!123",
      })
      .expect(201);
    const auth = authResponseSchema.parse(registered.body);
    userId = auth.user.id;
    accessToken = auth.tokens.accessToken;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it("returns a safe default profile and masked phone", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const profile = profileResponseSchema.parse(response.body);
    expect(profile).toMatchObject({
      userId,
      displayName: "骑行者",
      phoneMasked: expect.stringMatching(/^19\d\*{4}\d{4}$/),
      phoneVerificationStatus: "UNVERIFIED",
      gender: null,
      viewPreference: "SIMPLE",
      version: 1,
    });
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  it("patches only submitted fields and preserves the rest", async () => {
    const first = await request(app.getHttpServer())
      .post("/api/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "阿骑",
        gender: "PREFER_NOT_TO_SAY",
        heightCm: 178,
        expectedVersion: 1,
      })
      .expect(200);
    expect(first.body.displayName).toBe("阿骑");
    expect(first.body.heightCm).toBe(178);
    expect(first.body.weightKg).toBeNull();
    expect(first.body.version).toBe(2);

    const second = await request(app.getHttpServer())
      .post("/api/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ weightKg: 72.5, expectedVersion: 2 })
      .expect(200);
    expect(second.body.displayName).toBe("阿骑");
    expect(second.body.gender).toBe("PREFER_NOT_TO_SAY");
    expect(second.body.weightKg).toBe(72.5);
    expect(second.body.version).toBe(3);
  });

  it("rejects read-only fields, unknown fields, and stale versions", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ phone: "13812345678" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ displayName: "旧版本", expectedVersion: 1 })
      .expect(409);
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/api/v1/me/profile").expect(401);
  });
});
