import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import {
  nutritionGenerationInputSchema,
  nutritionLinkedGenerationRequestSchema,
  NutritionGenerationInput,
  NutritionLinkedGenerationRequest,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { NutritionGenerationService } from "./nutrition-generation.service";

@ApiTags("nutrition")
@ApiBearerAuth("access-token")
@Controller("nutrition")
export class NutritionGenerationController {
  constructor(private readonly service: NutritionGenerationService) {}

  @Post("plans/generate-proposal")
  @HttpCode(202)
  @ApiBody({ schema: toOpenApiSchema(nutritionGenerationInputSchema, "input") })
  submit(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodBodyPipe(nutritionGenerationInputSchema))
    input: NutritionGenerationInput,
  ) {
    return this.service.submit(principal.userId, input, idempotencyKey);
  }

  @Get("generations/:id")
  get(@CurrentPrincipal() principal: AuthPrincipal, @Param("id") id: string) {
    return this.service.get(principal.userId, id);
  }

  @Post("training-proposals/:trainingProposalId/generate-proposal")
  @HttpCode(202)
  @ApiBody({
    schema: toOpenApiSchema(nutritionLinkedGenerationRequestSchema, "input"),
  })
  submitFromTrainingProposal(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("trainingProposalId") trainingProposalId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodBodyPipe(nutritionLinkedGenerationRequestSchema))
    input: NutritionLinkedGenerationRequest,
  ) {
    return this.service.submit(
      principal.userId,
      {
        ...input,
        mode: "TRAINING_LINKED",
        trainingProposalId,
      },
      idempotencyKey,
    );
  }

  @Post("races/:raceId/generate-proposal")
  @HttpCode(202)
  @ApiBody({
    schema: toOpenApiSchema(nutritionLinkedGenerationRequestSchema, "input"),
  })
  submitFromRace(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("raceId") raceId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodBodyPipe(nutritionLinkedGenerationRequestSchema))
    input: NutritionLinkedGenerationRequest,
  ) {
    return this.service.submit(
      principal.userId,
      {
        ...input,
        mode: "RACE_LINKED",
        raceId,
      },
      idempotencyKey,
    );
  }
}
