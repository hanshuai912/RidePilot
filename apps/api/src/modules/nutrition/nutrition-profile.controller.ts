import { Body, Controller, Get, Put } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  nutritionProfileInputSchema,
  nutritionProfileResponseSchema,
  NutritionProfileInput,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { NutritionProfileService } from "./nutrition-profile.service";

@ApiTags("nutrition")
@ApiBearerAuth("access-token")
@Controller("nutrition/profile")
export class NutritionProfileController {
  constructor(private readonly service: NutritionProfileService) {}

  @Get()
  @ApiOkResponse({ schema: toOpenApiSchema(nutritionProfileResponseSchema) })
  get(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.get(principal.userId);
  }

  @Put()
  @ApiBody({ schema: toOpenApiSchema(nutritionProfileInputSchema, "input") })
  @ApiOkResponse({ schema: toOpenApiSchema(nutritionProfileResponseSchema) })
  put(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(nutritionProfileInputSchema))
    input: NutritionProfileInput,
  ) {
    return this.service.put(principal.userId, input);
  }
}
