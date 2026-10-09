import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  profilePatchSchema,
  profileResponseSchema,
  ProfilePatch,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import { AuthPrincipal } from "../auth/auth.types";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import { ProfileService } from "./profile.service";

@ApiTags("profile")
@ApiBearerAuth("access-token")
@Controller("me/profile")
export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  @ApiOperation({ summary: "读取当前用户信息与运动档案" })
  @ApiOkResponse({ schema: toOpenApiSchema(profileResponseSchema) })
  get(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.get(principal.userId);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "局部更新当前用户信息与运动档案" })
  @ApiBody({ schema: toOpenApiSchema(profilePatchSchema, "input") })
  @ApiOkResponse({ schema: toOpenApiSchema(profileResponseSchema) })
  @ApiConflictResponse({ description: "版本冲突" })
  patch(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(profilePatchSchema)) input: ProfilePatch,
  ) {
    return this.service.patch(principal.userId, input);
  }
}
