import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import {
  trainingNutritionStateSchema,
  nutritionProposalResponseSchema,
  type NutritionItemDraft,
  type NutritionGenerationInput,
} from "@ridepilot/contracts";
import { AiService } from "../src/ai/ai.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";
import { NutritionGenerationService } from "../src/modules/nutrition/nutrition-generation.service";
import { NutritionSkillLoaderService } from "../src/modules/nutrition/nutrition-skill-loader.service";

const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;
describeWithDatabase("training nutrition integration", () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let token: string;
  let planId: string;
  let trainingVersionId: string;
  let baseItemId: string;
  const users: string[] = [];
  const model = { generate: jest.fn() };
  const meal = (date: string, amount = 150): NutritionItemDraft => ({
    localDate: date,
    mealType: "BREAKFAST",
    scheduledLocalTime: "08:00",
    title: "米饭早餐",
    foods: [
      {
        name: "米饭",
        amount,
        unit: "g",
        allergenTags: ["SOY"],
        ingredientStatus: "KNOWN",
      },
    ],
    nutrients: {
      energyKcal: 200,
      carbohydrateG: 40,
      proteinG: 4,
      fatG: 1,
      fluidMl: null,
      sodiumMg: null,
    },
    nutritionSource: "CURATED",
    confidence: "HIGH",
    linkedWorkoutId: null,
    notes: null,
  });
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const post = (path: string) =>
    request(app.getHttpServer())
      .post(`/api/v1/nutrition/${path}`)
      .set(auth())
      .set("Idempotency-Key", randomUUID());
  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1/nutrition/${path}`).set(auth());
  const input = (): NutritionGenerationInput => ({
    startDate: "2030-01-01",
    endDate: "2030-01-01",
    mode: "TRAINING_LINKED",
    expectedNutritionVersion: 1,
    expectedTrainingPlanVersion: 1,
  });
  const output = () => ({
    model: "test",
    text: JSON.stringify({
      summary: "长骑后的补给调整",
      assumptions: ["按最新训练"],
      warnings: [],
      blockers: [],
      sourceRefs: [],
      confidence: "MEDIUM",
      draft: {
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        dailyTarget: null,
        items: [meal("2030-01-01", 200)],
      },
    }),
  });
  async function processJob(id: string) {
    await prisma.aiGeneration.update({
      where: { id },
      data: { status: "RUNNING", attempts: 1 },
    });
    await (
      app.get(NutritionGenerationService) as unknown as {
        process(id: string): Promise<void>;
      }
    ).process(id);
    return prisma.aiGeneration.findUniqueOrThrow({ where: { id } });
  }
  async function generate() {
    const submitted = await post("plans/generate-proposal")
      .send(input())
      .expect(202);
    const job = await processJob(submitted.body.generationId);
    expect(job.status).toBe("READY");
    return nutritionProposalResponseSchema.parse(
      (await get(`proposals/${job.proposalId}`).expect(200)).body,
    );
  }
  async function changeTraining() {
    const version = await prisma.planVersion.create({
      data: { planId, versionNo: 2, changeReason: "MANUAL", snapshot: {} },
    });
    await prisma.trainingPlan.update({
      where: { id: planId },
      data: { activeVersionId: version.id },
    });
    return version.id;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue(model)
      .overrideProvider(NutritionSkillLoaderService)
      .useValue({
        load: async () => ({
          content: "Test nutrition skill",
          version: "test",
          hash: "test",
        }),
      })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    app.get(NutritionGenerationService).onModuleDestroy();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    model.generate.mockReset().mockResolvedValue(output());
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        phone: `19${randomInt(100000000, 999999999)}`,
        verificationCode: "123456",
        password: "Ab!123",
        confirmPassword: "Ab!123",
      })
      .expect(201);
    userId = response.body.user.id;
    users.push(userId);
    token = response.body.tokens.accessToken;
    await prisma.nutritionProfile.create({
      data: {
        userId,
        dietStyle: "OMNIVORE",
        habits: [],
        allergens: [],
        restrictions: [],
        commonFoods: [],
        mealSchedule: [{ mealType: "BREAKFAST", localTime: "08:00" }],
      },
    });
    const plan = await prisma.trainingPlan.create({
      data: { userId, status: "ACTIVE" },
    });
    planId = plan.id;
    const version = await prisma.planVersion.create({
      data: { planId, versionNo: 1, changeReason: "MANUAL", snapshot: {} },
    });
    trainingVersionId = version.id;
    await prisma.trainingPlan.update({
      where: { id: planId },
      data: { activeVersionId: version.id },
    });
    await prisma.workout.create({
      data: {
        planVersionId: version.id,
        scheduledDate: new Date("2030-01-01T00:00:00Z"),
        dayOrder: 0,
        sportType: "CYCLING",
        source: "MANUAL",
        title: "长骑",
        purpose: "耐力",
        timeTargetMin: 180,
        structure: { durationSec: 10800 },
      },
    });
    const initial = await post("plans/proposals")
      .send({
        expectedNutritionVersion: 0,
        draft: {
          startDate: "2030-01-01",
          endDate: "2030-01-02",
          dailyTarget: null,
          items: [
            meal("2030-01-01"),
            meal("2030-01-01", 80),
            meal("2030-01-02"),
          ],
        },
      })
      .expect(201);
    await post(`proposals/${initial.body.proposalId}/validate`).expect(201);
    await post(`proposals/${initial.body.proposalId}/apply`)
      .send({ expectedNutritionVersion: 0 })
      .expect(201);
    baseItemId = (await get("plan?date=2030-01-01").expect(200)).body.items[0]
      .id;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });

  it("reads mismatch without creating a task; enforces auth, range and ownership", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/nutrition/training-link?date=2030-01-01")
      .expect(401);
    await get("training-link?from=2030-01-01&to=2030-03-01").expect(400);
    const state = trainingNutritionStateSchema.parse(
      (await get("training-link?from=2030-01-01&to=2030-01-02").expect(200))
        .body,
    );
    expect(state.affectedDates).toEqual(["2030-01-01", "2030-01-02"]);
    expect(state.generation).toBeNull();
    expect(
      await prisma.aiGeneration.count({
        where: { userId, scene: "NUTRITION_PLAN" },
      }),
    ).toBe(0);
    await get(`proposals/${randomUUID()}`).expect(404);
    await post("item-edit-proposals")
      .send({
        itemId: randomUUID(),
        expectedNutritionVersion: 1,
        scheduledLocalTime: "09:00",
        amounts: [100],
      })
      .expect(404);
  });

  it("deduplicates concurrent clicks and restores the same pending job", async () => {
    const results = await Promise.all([
      post("plans/generate-proposal").send(input()).expect(202),
      post("plans/generate-proposal").send(input()).expect(202),
    ]);
    expect(results[0].body.generationId).toBe(results[1].body.generationId);
    expect(
      (await get("training-link?date=2030-01-01").expect(200)).body.generation
        .generationId,
    ).toBe(results[0].body.generationId);
    expect(
      await prisma.aiGeneration.count({
        where: { userId, scene: "NUTRITION_PLAN" },
      }),
    ).toBe(1);
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("requires a dietary profile and does not create a job on failure", async () => {
    await prisma.nutritionProfile.delete({ where: { userId } });
    const result = await post("plans/generate-proposal")
      .send(input())
      .expect(400);
    expect(result.body.code).toBe("NUTRITION_PROFILE_REQUIRED");
    expect(await prisma.aiGeneration.count({ where: { userId } })).toBe(0);
  });

  it("generates from latest workouts, previews originals and preserves nutrition outside the range", async () => {
    const proposal = await generate();
    expect(proposal.original?.items).toHaveLength(2);
    expect(proposal.metadata?.trainingContext?.planVersionId).toBe(
      trainingVersionId,
    );
    expect(model.generate.mock.calls[0][0].messages.at(-1).content).toContain(
      '"timeTargetMin":180',
    );
    expect((await get("plan?date=2030-01-01").expect(200)).body.version).toBe(
      1,
    );
    const applied = await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedNutritionVersion: 1 })
      .expect(201);
    expect(applied.body.affectedDates).toEqual(["2030-01-01"]);
    expect(
      (await get("plan?date=2030-01-02").expect(200)).body.items[0].foods[0]
        .amount,
    ).toBe(150);
    const again = await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedNutritionVersion: 1 })
      .expect(201);
    expect(again.body).toEqual(applied.body);
    const state = trainingNutritionStateSchema.parse(
      (await get("training-link?from=2030-01-01&to=2030-01-02").expect(200))
        .body,
    );
    expect(state.affectedDates).toEqual(["2030-01-02"]);
    expect(
      (await get("training-link?date=2030-01-01").expect(200)).body.proposal
        .status,
    ).toBe("APPLIED");
    // Re-entering / clicking generate reuses the official result until explicit regeneration.
    expect(
      (
        await post("plans/generate-proposal")
          .send({ ...input(), expectedNutritionVersion: 2 })
          .expect(202)
      ).body.proposalId,
    ).toBe(proposal.proposalId);
    const regenerated = await post("plans/generate-proposal")
      .send({ ...input(), expectedNutritionVersion: 2, forceRegenerate: true })
      .expect(202);
    expect(regenerated.body.proposalId).toBeNull();
    expect(
      (await get("training-link?date=2030-01-01").expect(200)).body.generation
        .generationId,
    ).toBe(regenerated.body.generationId);
  });

  it("detects a removed long ride and blocks applying a stale training draft", async () => {
    const proposal = await generate();
    await changeTraining();
    const rejected = await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedNutritionVersion: 1 })
      .expect(409);
    expect(rejected.body.code).toBe("PLAN_VERSION_CONFLICT");
    expect(
      (await get("training-link?date=2030-01-01").expect(200)).body.proposal,
    ).toBeNull();
    expect((await get("plan?date=2030-01-02").expect(200)).body.version).toBe(
      1,
    );
  });

  it("checks versions again after model work, before persisting a proposal", async () => {
    model.generate.mockImplementationOnce(async () => {
      await changeTraining();
      return output();
    });
    const response = await post("plans/generate-proposal")
      .send(input())
      .expect(202);
    const job = await processJob(response.body.generationId);
    expect(job.status).toBe("FAILED");
    expect(job.errorCode).toBe("PLAN_VERSION_CONFLICT");
    expect(job.proposalId).toBeNull();
  });

  it("accepts an applied AI training proposal against its applied version", async () => {
    const trainingProposal = await prisma.changeProposal.create({
      data: {
        userId,
        proposalType: "AI_WORKOUT_ADJUST",
        status: "APPLIED",
        appliedVersionId: trainingVersionId,
        draft: {},
        original: {},
      },
    });
    await post(`training-proposals/${trainingProposal.id}/generate-proposal`)
      .send({
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        expectedNutritionVersion: 1,
        expectedTrainingPlanVersion: 1,
      })
      .expect(202);
  });

  it("edits one exact meal, preserves allergen metadata and revalidates before apply", async () => {
    await post("item-edit-proposals")
      .send({
        itemId: baseItemId,
        expectedNutritionVersion: 1,
        scheduledLocalTime: "25:00",
        amounts: [100],
      })
      .expect(400);
    const edited = await post("item-edit-proposals")
      .send({
        itemId: baseItemId,
        expectedNutritionVersion: 1,
        scheduledLocalTime: "09:30",
        amounts: [100],
      })
      .expect(201);
    const proposal = nutritionProposalResponseSchema.parse(edited.body);
    expect(proposal.proposalType).toBe("ITEM_EDIT");
    expect(
      proposal.draft.items.filter(
        (item) => item.scheduledLocalTime === "09:30",
      ),
    ).toHaveLength(1);
    expect(
      proposal.draft.items.find((item) => item.scheduledLocalTime === "08:00")
        ?.foods[0].amount,
    ).toBe(80);
    expect(proposal.draft.items[0].foods[0].allergenTags).toEqual(["SOY"]);
    expect(proposal.draft.items[0].nutrients.energyKcal).toBeNull();
    await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedNutritionVersion: 1 })
      .expect(409);
    await post(`proposals/${proposal.proposalId}/validate`).expect(201);
    await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedNutritionVersion: 1 })
      .expect(201);
    expect(
      (await get("plan?date=2030-01-02").expect(200)).body.items,
    ).toHaveLength(1);
  });

  it("draft edits have optimistic versions, fixed coverage and require revalidation", async () => {
    const proposal = await generate();
    const patch = () =>
      request(app.getHttpServer())
        .patch(`/api/v1/nutrition/proposals/${proposal.proposalId}`)
        .set(auth());
    await patch()
      .send({
        expectedProposalVersion: 1,
        draft: { ...proposal.draft, endDate: "2030-01-02" },
      })
      .expect(400);
    const changed = await patch()
      .send({
        expectedProposalVersion: 1,
        draft: { ...proposal.draft, items: [meal("2030-01-01", 90)] },
      })
      .expect(200);
    expect(changed.body).toMatchObject({ status: "DRAFT", proposalVersion: 2 });
    await patch()
      .send({ expectedProposalVersion: 1, draft: proposal.draft })
      .expect(409);
    await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedNutritionVersion: 1 })
      .expect(409);
    await post(`proposals/${proposal.proposalId}/validate`).expect(201);
    await prisma.nutritionProfile.update({
      where: { userId },
      data: { allergens: ["SOY"] },
    });
    const blocked = await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedNutritionVersion: 1 })
      .expect(409);
    expect(blocked.body.code).toBe("NUTRITION_VALIDATION_FAILED");
  });
  it("rejects another user's training proposal without leaking it", async () => {
    const other = await prisma.user.create({ data: {} });
    users.push(other.id);
    const foreign = await prisma.changeProposal.create({
      data: {
        userId: other.id,
        proposalType: "AI_WORKOUT_ADJUST",
        status: "APPLIED",
        appliedVersionId: trainingVersionId,
        draft: {},
      },
    });
    const result = await post(
      `training-proposals/${foreign.id}/generate-proposal`,
    )
      .send({
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        expectedNutritionVersion: 1,
        expectedTrainingPlanVersion: 1,
      })
      .expect(404);
    expect(result.body.code).toBe("TRAINING_PROPOSAL_NOT_FOUND");
  });

  it("rechecks nutrition changes that happen during model generation", async () => {
    model.generate.mockImplementationOnce(async () => {
      const proposal = await post("plans/proposals")
        .send({
          expectedNutritionVersion: 1,
          draft: {
            startDate: "2030-01-02",
            endDate: "2030-01-02",
            items: [meal("2030-01-02", 100)],
          },
        })
        .expect(201);
      await post(`proposals/${proposal.body.proposalId}/validate`).expect(201);
      await post(`proposals/${proposal.body.proposalId}/apply`)
        .send({ expectedNutritionVersion: 1 })
        .expect(201);
      return output();
    });
    const submitted = await post("plans/generate-proposal")
      .send(input())
      .expect(202);
    const job = await processJob(submitted.body.generationId);
    expect(job.status).toBe("FAILED");
    expect(job.errorCode).toBe("NUTRITION_VERSION_CONFLICT");
    expect(job.proposalId).toBeNull();
  });

  it("marks a previously aligned date as affected after its long ride is removed", async () => {
    const proposal = await generate();
    await post(`proposals/${proposal.proposalId}/apply`)
      .send({ expectedNutritionVersion: 1 })
      .expect(201);
    expect(
      (await get("training-link?date=2030-01-01").expect(200)).body
        .affectedDates,
    ).toEqual([]);
    await changeTraining();
    const state = (await get("training-link?date=2030-01-01").expect(200)).body;
    expect(state.affectedDates).toEqual(["2030-01-01"]);
    expect(state.proposal).toBeNull();
    await post("plans/generate-proposal")
      .send({
        ...input(),
        expectedNutritionVersion: 2,
        expectedTrainingPlanVersion: 2,
      })
      .expect(202);
  });
});
