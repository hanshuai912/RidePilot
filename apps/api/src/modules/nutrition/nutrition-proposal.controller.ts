import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import {
  applyNutritionProposalSchema,
  createNutritionMealSwapProposalSchema,
  createNutritionPlanProposalSchema,
  updateNutritionProposalSchema,
  type ApplyNutritionProposal,
  type CreateNutritionMealSwapProposal,
  type CreateNutritionPlanProposal,
  type UpdateNutritionProposal,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { NutritionProposalService } from "./nutrition-proposal.service";

@ApiTags("nutrition")
@ApiBearerAuth("access-token")
@Controller()
export class NutritionProposalController {
  constructor(private readonly service: NutritionProposalService) {}

  @Post("nutrition/plans/proposals")
  @ApiBody({
    schema: toOpenApiSchema(createNutritionPlanProposalSchema, "input"),
  })
  createPlan(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodBodyPipe(createNutritionPlanProposalSchema))
    input: CreateNutritionPlanProposal,
  ) {
    return this.service.createPlanProposal(
      principal.userId,
      input,
      idempotencyKey,
    );
  }

  @Post("nutrition/meal-swap-proposals")
  @ApiBody({
    schema: toOpenApiSchema(createNutritionMealSwapProposalSchema, "input"),
  })
  createMealSwap(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodBodyPipe(createNutritionMealSwapProposalSchema))
    input: CreateNutritionMealSwapProposal,
  ) {
    return this.service.createMealSwapProposal(
      principal.userId,
      input,
      idempotencyKey,
    );
  }

  @Get("nutrition/proposals/:proposalId")
  get(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("proposalId") proposalId: string,
  ) {
    return this.service.get(principal.userId, proposalId);
  }

  @Patch("nutrition/proposals/:proposalId")
  @ApiBody({ schema: toOpenApiSchema(updateNutritionProposalSchema, "input") })
  update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("proposalId") proposalId: string,
    @Body(new ZodBodyPipe(updateNutritionProposalSchema))
    input: UpdateNutritionProposal,
  ) {
    return this.service.update(principal.userId, proposalId, input);
  }

  @Post("nutrition/proposals/:proposalId/validate")
  validate(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("proposalId") proposalId: string,
  ) {
    return this.service.validate(principal.userId, proposalId);
  }

  @Post("nutrition/proposals/:proposalId/apply")
  @ApiBody({ schema: toOpenApiSchema(applyNutritionProposalSchema, "input") })
  apply(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("proposalId") proposalId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodBodyPipe(applyNutritionProposalSchema))
    input: ApplyNutritionProposal,
  ) {
    return this.service.apply(
      principal.userId,
      proposalId,
      input,
      idempotencyKey,
    );
  }
}
