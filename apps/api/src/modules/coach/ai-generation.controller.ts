import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  weekGenerationInputSchema,
  type WeekGenerationInput,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { AiGenerationService } from "./ai-generation.service";

@ApiTags("ai-coach")
@ApiBearerAuth("access-token")
@Controller()
export class AiGenerationController {
  constructor(private readonly generations: AiGenerationService) {}

  @Post("plans/generate-proposal")
  @HttpCode(202)
  generate(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(weekGenerationInputSchema))
    input: WeekGenerationInput,
  ) {
    return this.generations.submit(principal.userId, input, key);
  }

  @Post("workouts/:id/ai-adjust-proposal")
  @HttpCode(202)
  adjustWorkout(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("id") id: string,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(weekGenerationInputSchema))
    input: WeekGenerationInput,
  ) {
    return this.generations.submit(
      principal.userId,
      { ...input, mode: "replace_workout", targetWorkoutId: id },
      key,
      "WORKOUT_ADJUST",
    );
  }

  @Post("plans/adjust-proposal")
  @HttpCode(202)
  adjustPlan(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(weekGenerationInputSchema))
    input: WeekGenerationInput,
  ) {
    return this.generations.submit(principal.userId, input, key, "PLAN_ADJUST");
  }

  @Post("assessments/:id/review-proposal")
  @HttpCode(202)
  reviewAssessment(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("id") id: string,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(weekGenerationInputSchema))
    input: WeekGenerationInput,
  ) {
    return this.generations.submit(
      principal.userId,
      { ...input, mode: "replace_week", relatedId: id, reason: "ASSESSMENT" },
      key,
      "ASSESSMENT_REVIEW",
    );
  }

  @Post("races/:id/replan-proposal")
  @HttpCode(202)
  replanRace(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("id") id: string,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(weekGenerationInputSchema))
    input: WeekGenerationInput,
  ) {
    return this.generations.submit(
      principal.userId,
      { ...input, mode: "replace_week", relatedId: id, reason: "RACE" },
      key,
      "RACE_REPLAN",
    );
  }

  @Get("ai-coach/generations/:id")
  get(@CurrentPrincipal() principal: AuthPrincipal, @Param("id") id: string) {
    return this.generations.get(principal.userId, id);
  }
}
