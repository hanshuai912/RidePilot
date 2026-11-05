import { TrainingNutritionService } from "../src/modules/nutrition/training-nutrition.service";
import { INestApplication, NotFoundException } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { raceNutritionStateSchema } from "@ridepilot/contracts";
import { AuthGuard } from "../src/modules/auth/auth.guard";
import { AuthService } from "../src/modules/auth/auth.service";
import { NutritionGenerationController } from "../src/modules/nutrition/nutrition-generation.controller";
import { NutritionGenerationService } from "../src/modules/nutrition/nutrition-generation.service";
import { RaceNutritionService } from "../src/modules/nutrition/race-nutrition.service";

describe("race nutrition lookup HTTP contract", () => {
  let app: INestApplication;
  const get = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NutritionGenerationController],
      providers: [
        { provide: TrainingNutritionService, useValue: {} },
        { provide: NutritionGenerationService, useValue: {} },
        { provide: RaceNutritionService, useValue: { get } },
        {
          provide: AuthService,
          useValue: {
            authenticateAccess: async (token: string) =>
              token === "valid"
                ? { userId: "owner", sessionId: "session" }
                : null,
          },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ generation: null, proposal: null });
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/nutrition/races/race/proposal")
      .expect(401);
    expect(get).not.toHaveBeenCalled();
  });
  it("returns the shared lookup contract for the authenticated user", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/nutrition/races/race/proposal")
      .set("Authorization", "Bearer valid")
      .expect(200);
    expect(raceNutritionStateSchema.parse(response.body)).toEqual({
      generation: null,
      proposal: null,
    });
    expect(get).toHaveBeenCalledWith("owner", "race");
  });
  it("returns 404 for an unowned race", async () => {
    get.mockRejectedValue(
      new NotFoundException({ code: "RACE_NOT_FOUND", message: "赛事不存在" }),
    );
    const response = await request(app.getHttpServer())
      .get("/api/v1/nutrition/races/race/proposal")
      .set("Authorization", "Bearer valid")
      .expect(404);
    expect(response.body.code).toBe("RACE_NOT_FOUND");
  });
});
