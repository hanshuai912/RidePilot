import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomInt, randomUUID } from "node:crypto";
import request from "supertest";
import { aiWeekOutputSchema } from "@ridepilot/contracts";
import { AiService } from "../src/ai/ai.service";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/infra/prisma/prisma.service";

const describeLive =
  process.env.RUN_LIVE_AI === "1" && process.env.TEST_DATABASE_URL
    ? describe
    : describe.skip;

describeLive("AI coach live provider smoke test", () => {
  jest.setTimeout(150_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const ai = app.get(AiService);
    const original = ai.generate.bind(ai);
    jest.spyOn(ai, "generate").mockImplementation(async (input) => {
      const response = await original(input);
      let diagnostic: unknown;
      try {
        const parsed: unknown = JSON.parse(response.text);
        const check = aiWeekOutputSchema.safeParse(parsed);
        diagnostic = check.success
          ? "valid"
          : check.error.issues.map(
              (issue) => `${issue.path.join(".")}: ${issue.code}`,
            );
      } catch {
        diagnostic = "invalid-json";
      }
      console.log(
        "LIVE_AI_OUTPUT_CHECK",
        JSON.stringify({
          length: response.text.length,
          diagnostic,
          tail: response.text.slice(-100),
        }),
      );
      return response;
    });
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await app?.close();
  });

  it("returns a real week draft for a 4 W/kg goal without applying it", async () => {
    const auth = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        phone: `19${randomInt(100_000_000, 1_000_000_000)}`,
        verificationCode: "123456",
        password: "Ab!123",
        confirmPassword: "Ab!123",
      })
      .expect(201);
    userId = auth.body.user.id as string;
    const token = auth.body.tokens.accessToken as string;
    const post = (path: string) =>
      request(app.getHttpServer())
        .post(`/api/v1/${path}`)
        .set("Authorization", `Bearer ${token}`);
    const get = (path: string) =>
      request(app.getHttpServer())
        .get(`/api/v1/${path}`)
        .set("Authorization", `Bearer ${token}`);
    const profile = await get("me/profile").expect(200);
    await post("me/profile")
      .send({
        expectedVersion: profile.body.version,
        timezone: "Asia/Shanghai",
        heightCm: 170,
        weightKg: 55,
        experienceLevel: "BEGINNER",
      })
      .expect(200);
    await post("me/ability-measurements/ftp")
      .send({
        valueWatts: 193,
        measuredAt: new Date().toISOString(),
        source: "MANUAL",
      })
      .expect(201);
    await request(app.getHttpServer())
      .put("/api/v1/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "Asia/Shanghai",
        weekdays: [
          { weekday: 2, availableMinutes: 60 },
          { weekday: 4, availableMinutes: 75 },
          { weekday: 6, availableMinutes: 90 },
        ],
        maxSessionMinutes: 90,
      })
      .expect(200);
    const goalDate = new Date();
    goalDate.setUTCMonth(goalDate.getUTCMonth() + 6);
    const targetDate = goalDate.toISOString().slice(0, 10);
    const goal = await post("goals")
      .send({
        type: "FTP",
        description: "循序渐进地达到 4 W/kg，不要求一周内完成",
        targetWkg: 4,
        targetDate,
        priority: "PRIMARY",
      })
      .expect(201);
    const today = new Date();
    const monday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7) + 7);
    const weekStartDate = monday.toISOString().slice(0, 10);
    const submitted = await post("plans/generate-proposal")
      .set("Idempotency-Key", randomUUID())
      .send({
        weekStartDate,
        goalId: goal.body.id,
        mode: "initial",
        expectedBaseVersion: 0,
      })
      .expect(202);
    let job = submitted.body;
    for (
      let attempt = 0;
      attempt < 120 && !["READY", "FAILED"].includes(job.status);
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      job = (
        await get(`ai-coach/generations/${submitted.body.generationId}`).expect(
          200,
        )
      ).body;
    }
    if (job.status !== "READY") {
      console.log(
        "LIVE_AI_RESULT",
        JSON.stringify({
          status: job.status,
          errorCode: job.errorCode,
          requestId: job.requestId,
        }),
      );
    }
    expect(job.status).toBe("READY");
    const proposal = await get(`proposals/${job.proposalId}`).expect(200);
    const status = await get("plans/active/status").expect(200);
    expect(status.body.hasActivePlan).toBe(false);
    console.log(
      "LIVE_AI_RESULT",
      JSON.stringify({
        requestId: job.requestId,
        status: job.status,
        model: proposal.body.model,
        input: {
          heightCm: 170,
          weightKg: 55,
          ftpWatts: 193,
          currentWkg: Math.round((193 / 55) * 100) / 100,
          targetWkg: 4,
          targetFtpWatts: 220,
          targetDate,
          availableWeekdays: [2, 4, 6],
        },
        summary: proposal.body.summary,
        stageSummary: proposal.body.stageSummary,
        assessmentSuggestion: proposal.body.assessmentSuggestion,
        workouts: proposal.body.workouts,
        applied: false,
      }),
    );
  });
});
