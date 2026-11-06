import { toOpenApiSchema } from "../../../docs/zod-openapi";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiHeader,
} from "@nestjs/swagger";
import {
  stageReviewStateSchema,
  stageReviewEvidenceSchema,
  stageCriteriaInputSchema,
  stageReviewInputSchema,
  type StageReviewInput,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../../common/zod-body.pipe";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import type { AuthPrincipal } from "../../auth/auth.types";
import { StageReviewService } from "./stage-review.service";

@ApiTags("goals-stages")
@ApiBearerAuth("access-token")
@Controller("stages/:id")
export class StageReviewController {
  constructor(private readonly reviews: StageReviewService) {}
  @Get("review")
  @ApiOkResponse({ schema: toOpenApiSchema(stageReviewStateSchema) })
  get(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.reviews.state(p.userId, id);
  }
  @Put("criteria")
  @ApiBody({ schema: toOpenApiSchema(stageCriteriaInputSchema, "input") })
  @ApiOkResponse({ schema: toOpenApiSchema(stageReviewStateSchema) })
  criteria(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(stageCriteriaInputSchema))
    input: { criteria: string; expectedVersion: number },
  ) {
    return this.reviews.criteria(p.userId, id, input);
  }
  @Post("reviews")
  @ApiBody({ schema: toOpenApiSchema(stageReviewInputSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(stageReviewEvidenceSchema) })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  save(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(stageReviewInputSchema)) input: StageReviewInput,
  ) {
    return this.reviews.save(p.userId, id, input, key);
  }
}
