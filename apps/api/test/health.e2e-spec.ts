import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { RedisService } from "../src/infra/redis/redis.service";

describe("GET /api/v1/health", () => {
  let app: INestApplication;
  const queryRaw = jest.fn<Promise<unknown>, unknown[]>();
  const ping = jest.fn<Promise<string>, []>();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .overrideProvider(RedisService)
      .useValue({ ping })
      .compile();

    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([{ "?column?": 1 }]);
    ping.mockReset().mockResolvedValue("PONG");
  });

  it("returns 200 when PostgreSQL and Redis are available", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200)
      .expect({
        status: "ok",
        services: { database: "ok", redis: "ok" },
      });
  });

  it("returns 503 without leaking connection details when PostgreSQL fails", async () => {
    queryRaw.mockRejectedValue(new Error("secret connection string"));

    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(503);
    expect(response.body).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    expect(JSON.stringify(response.body)).not.toContain(
      "secret connection string",
    );
  });

  it("returns 503 when Redis fails", async () => {
    ping.mockRejectedValue(new Error("connection refused"));

    await request(app.getHttpServer()).get("/api/v1/health").expect(503);
  });

  it("serves Swagger UI and the health OpenAPI contract", async () => {
    await request(app.getHttpServer()).get("/api/docs").expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/docs-json")
      .expect(200);
    const health = response.body.paths["/api/v1/health"].get;

    expect(response.body.openapi).toMatch(/^3\./);
    expect(
      health.responses["200"].content["application/json"].schema,
    ).toMatchObject({
      type: "object",
      required: ["status", "services"],
      properties: {
        status: { type: "string", enum: ["ok"] },
        services: {
          type: "object",
          required: ["database", "redis"],
        },
      },
    });
    expect(health.responses["503"]).toBeDefined();
  });
});
