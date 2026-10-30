import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  activateStagePlanSchema,
  rangeGenerationSchema,
  stagePlanGenerationSchema,
  type RangeGeneration,
  type StagePlanGeneration,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { AiGenerationService } from "./ai-generation.service";
import { StagePlansService } from "./stage-plans.service";
import { TrainingRangeService } from "./training-range.service";

@ApiTags("goals-stages")
@ApiBearerAuth("access-token")
@Controller()
export class StagePlansController {
  constructor(
    private readonly stages: StagePlansService,
    private readonly ranges: TrainingRangeService,
    private readonly generations: AiGenerationService,
  ) {}

  @Get("goals/:id/stage-plan")
  async active(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return { plan: await this.stages.active(p.userId, id) };
  }
  @Get("stage-plans/:id")
  get(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.stages.get(p.userId, id);
  }
  @Post("stage-plans/generate-proposal")
  @HttpCode(202)
  generate(
    @CurrentPrincipal() p: AuthPrincipal,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(stagePlanGenerationSchema))
    input: StagePlanGeneration,
  ) {
    return this.stages.submit(p.userId, input, key);
  }
  @Post("stage-plans/:id/activate")
  activate(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(activateStagePlanSchema))
    input: { expectedVersion: number },
  ) {
    return this.stages.activate(p.userId, id, input.expectedVersion);
  }
  @Post("plans/generate-range-proposal")
  @HttpCode(202)
  async range(
    @CurrentPrincipal() p: AuthPrincipal,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(rangeGenerationSchema)) input: RangeGeneration,
  ) {
    return this.generations.submit(
      p.userId,
      await this.ranges.resolve(p.userId, input),
      key,
      "RANGE_PLAN",
    );
  }
}
