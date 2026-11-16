import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  authResponseSchema,
  nutritionPlanResponseSchema,
  nutritionProfileResponseSchema,
  nutritionProposalResponseSchema,
} from "@ridepilot/contracts";
import { randomInt } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { NutritionGenerationContextService } from "../src/modules/nutrition/nutrition-generation-context.service";

const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase("nutrition API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let accessToken: string;
  let otherUserId: string | undefined;

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
    if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it("creates a profile, applies a plan proposal, and reads the active day", async () => {
    const profile = await request(app.getHttpServer())
      .put("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        dietStyle: "OMNIVORE",
        habits: ["HOME_COOKING"],
        allergens: ["PEANUT"],
        restrictions: [],
        restrictionNote: null,
        commonFoods: ["米饭", "鸡蛋"],
        mealSchedule: [{ mealType: "BREAKFAST", localTime: "07:30" }],
      })
      .expect(200);
    expect(nutritionProfileResponseSchema.parse(profile.body).version).toBe(1);

    const draft = {
      startDate: "2030-01-01",
      endDate: "2030-01-01",
      dailyTarget: null,
      items: [
        {
          localDate: "2030-01-01",
          mealType: "BREAKFAST",
          scheduledLocalTime: "07:30",
          title: "早餐",
          foods: [
            {
              name: "米饭",
              amount: 150,
              unit: "g",
              allergenTags: [],
              ingredientStatus: "KNOWN",
            },
          ],
          nutrients: {
            energyKcal: 220,
            carbohydrateG: 45,
            proteinG: 4,
            fatG: 1,
            fluidMl: null,
            sodiumMg: null,
          },
          nutritionSource: "CURATED",
          confidence: "HIGH",
          linkedWorkoutId: null,
          notes: null,
        },
      ],
    };
    const proposal = await request(app.getHttpServer())
      .post("/api/v1/nutrition/plans/proposals")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "nutrition-create-1")
      .send({ expectedNutritionVersion: 0, draft })
      .expect(201);
    const proposalBody = nutritionProposalResponseSchema.parse(proposal.body);

    await request(app.getHttpServer())
      .post(`/api/v1/nutrition/proposals/${proposalBody.proposalId}/validate`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    const applied = await request(app.getHttpServer())
      .post(`/api/v1/nutrition/proposals/${proposalBody.proposalId}/apply`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "nutrition-apply-1")
      .send({ expectedNutritionVersion: 0 })
      .expect(201);
    expect(applied.body).toMatchObject({
      success: true,
      newNutritionVersion: 1,
    });

    const plan = await request(app.getHttpServer())
      .get("/api/v1/nutrition/plan?date=2030-01-01")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(nutritionPlanResponseSchema.parse(plan.body).items).toHaveLength(1);
  });

  it("blocks a stale nutrition version", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/nutrition/plans/proposals")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        expectedNutritionVersion: 0,
        draft: {
          startDate: "2030-01-02",
          endDate: "2030-01-02",
          dailyTarget: null,
          items: [
            {
              localDate: "2030-01-02",
              mealType: "BREAKFAST",
              scheduledLocalTime: "07:30",
              title: "早餐",
              foods: [
                {
                  name: "米饭",
                  amount: 100,
                  unit: "g",
                  allergenTags: [],
                  ingredientStatus: "KNOWN",
                },
              ],
              nutrients: {
                energyKcal: 100,
                carbohydrateG: 20,
                proteinG: 2,
                fatG: 0,
                fluidMl: null,
                sodiumMg: null,
              },
              nutritionSource: "CURATED",
              confidence: "HIGH",
              linkedWorkoutId: null,
              notes: null,
            },
          ],
        },
      })
      .expect(409);
  });

  it("persists the shared dietary profile and rejects stale or invalid updates", async () => {
    const read = await request(app.getHttpServer())
      .get("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const {
      id: _id,
      version,
      ...current
    } = nutritionProfileResponseSchema.parse(read.body);
    const input = {
      ...current,
      dietStyle: "VEGAN",
      habits: ["EATING_OUT", "LIMITED_PREP_TIME"],
      allergens: ["PEANUT", "MILK"],
      restrictions: ["NO_PORK", "OTHER"],
      restrictionNote: "避免辛辣食物",
      expectedVersion: version,
    };
    const saved = await request(app.getHttpServer())
      .put("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(input)
      .expect(200);
    expect(saved.body).toMatchObject({
      version: version + 1,
      commonFoods: current.commonFoods,
      mealSchedule: current.mealSchedule,
      restrictions: input.restrictions,
      allergens: input.allergens,
    });
    const again = await request(app.getHttpServer())
      .get("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(nutritionProfileResponseSchema.parse(again.body)).toEqual(
      nutritionProfileResponseSchema.parse(saved.body),
    );
    const context = await app
      .get(NutritionGenerationContextService)
      .read(userId, {
        mode: "REGENERATE",
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        expectedNutritionVersion: 1,
      });
    expect(context.nutritionProfile).toMatchObject({
      dietStyle: "VEGAN",
      version: version + 1,
      allergens: ["PEANUT", "MILK"],
      restrictions: ["NO_PORK", "OTHER"],
      restrictionNote: "避免辛辣食物",
    });
    await request(app.getHttpServer())
      .put("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(input)
      .expect(409);
    await request(app.getHttpServer())
      .put("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...input, expectedVersion: version + 1, restrictionNote: "" })
      .expect(400);
  });

  it("authenticates profile access and keeps another account's preferences separate", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/nutrition/profile")
      .expect(401);
    const registered = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        phone: `19${randomInt(100_000_000, 999_999_999)}`,
        verificationCode: "123456",
        password: "Ab!123",
        confirmPassword: "Ab!123",
      })
      .expect(201);
    const auth = authResponseSchema.parse(registered.body);
    otherUserId = auth.user.id;
    const otherToken = auth.tokens.accessToken;
    await request(app.getHttpServer())
      .get("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .put("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        dietStyle: "OMNIVORE",
        habits: [],
        allergens: [],
        restrictions: [],
        commonFoods: ["燕麦"],
        mealSchedule: [{ mealType: "BREAKFAST", localTime: "08:30" }],
      })
      .expect(200);
    const original = await request(app.getHttpServer())
      .get("/api/v1/nutrition/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(original.body.allergens).toEqual(["PEANUT", "MILK"]);
    expect(original.body.dietStyle).toBe("VEGAN");
  });
});
