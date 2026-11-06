import { toOpenApiSchema } from "../../../docs/zod-openapi";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
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
  goalOverviewSchema,
  goalCreationPreviewSchema,
  goalChangePreviewSchema,
  goalChangeResultSchema,
  applyGoalChangeSchema,
  goalChangeSchema,
  goalInputSchema,
  type GoalInput,
  type GoalChange,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../../common/zod-body.pipe";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import type { AuthPrincipal } from "../../auth/auth.types";
import { GoalLifecycleService } from "./goal-lifecycle.service";

@ApiTags("goals-stages")
@ApiBearerAuth("access-token")
@Controller("goals")
export class GoalLifecycleController {
  constructor(private readonly goals: GoalLifecycleService) {}
  @Post("evaluate")
  @ApiBody({ schema: toOpenApiSchema(goalInputSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(goalCreationPreviewSchema) })
  evaluate(
    @CurrentPrincipal() p: AuthPrincipal,
    @Body(new ZodBodyPipe(goalInputSchema)) input: GoalInput,
  ) {
    return this.goals.evaluate(p.userId, input);
  }
  @Get(":id/overview")
  @ApiOkResponse({ schema: toOpenApiSchema(goalOverviewSchema) })
  overview(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.goals.overview(p.userId, id);
  }
  @Post(":id/change-preview")
  @ApiBody({ schema: toOpenApiSchema(goalChangeSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(goalChangePreviewSchema) })
  preview(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(goalChangeSchema)) input: GoalChange,
  ) {
    return this.goals.preview(p.userId, id, input);
  }
  @Post(":id/changes")
  @ApiBody({ schema: toOpenApiSchema(applyGoalChangeSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(goalChangeResultSchema) })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  apply(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(applyGoalChangeSchema))
    input: { change: GoalChange; fingerprint: string },
  ) {
    return this.goals.apply(p.userId, id, input.change, input.fingerprint, key);
  }
}
