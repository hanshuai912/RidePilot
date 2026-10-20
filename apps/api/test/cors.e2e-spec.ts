import { INestApplication, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configureApp } from "../src/configure-app";

@Module({})
class CorsTestModule {}

describe("API CORS", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CorsTestModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepts Expo Web preflight with Authorization and JSON headers", async () => {
    const origin = "http://localhost:8081";
    const response = await request(app.getHttpServer())
      .options("/api/v1/auth/login")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
    expect(
      response.headers["access-control-allow-headers"].toLowerCase(),
    ).toContain("authorization");
    expect(
      response.headers["access-control-allow-headers"].toLowerCase(),
    ).toContain("content-type");
  });
});
