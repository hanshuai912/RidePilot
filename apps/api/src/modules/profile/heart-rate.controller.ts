import { Body, Controller, Get, Put } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  HeartRateSave,
  heartRateReadSchema,
  heartRateResponseSchema,
  heartRateSaveSchema,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import { AuthPrincipal } from "../auth/auth.types";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import { HeartRateService } from "./heart-rate.service";

@ApiTags("profile")
@ApiBearerAuth("access-token")
@Controller("me/heart-rate-settings")
export class HeartRateController {
  constructor(private readonly service: HeartRateService) {}

  @Get()
  @ApiOperation({ summary: "读取统一心率区间设置，未设置时返回 null" })
  @ApiOkResponse({ schema: toOpenApiSchema(heartRateReadSchema) })
  async get(@CurrentPrincipal() principal: AuthPrincipal) {
    return { settings: await this.service.get(principal.userId) };
  }

  @Put()
  @ApiOperation({ summary: "保存统一心率区间设置" })
  @ApiBody({ schema: toOpenApiSchema(heartRateSaveSchema, "input") })
  @ApiOkResponse({ schema: toOpenApiSchema(heartRateResponseSchema) })
  @ApiConflictResponse({ description: "心率设置版本冲突" })
  save(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(heartRateSaveSchema)) input: HeartRateSave,
  ) {
    return this.service.save(principal.userId, input);
  }
}
