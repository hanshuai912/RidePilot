import { Body, Controller, HttpCode, Ip, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  AuthResponse,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  authResponseSchema,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { Public } from "../../common/public.decorator";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import { AuthService } from "./auth.service";
import { CurrentPrincipal } from "./current-principal.decorator";
import { AuthPrincipal } from "./auth.types";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Public()
  @ApiOperation({ summary: "测试阶段手机号注册" })
  @ApiBody({ schema: toOpenApiSchema(registerRequestSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(authResponseSchema) })
  @ApiConflictResponse({ description: "手机号已注册" })
  register(
    @Body(new ZodBodyPipe(registerRequestSchema)) input: RegisterRequest,
    @Ip() ip: string,
  ): Promise<AuthResponse> {
    return this.auth.register(input, ip);
  }

  @Post("login")
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: "手机号和密码登录" })
  @ApiBody({ schema: toOpenApiSchema(loginRequestSchema, "input") })
  @ApiOkResponse({ schema: toOpenApiSchema(authResponseSchema) })
  @ApiUnauthorizedResponse({ description: "手机号或密码错误" })
  login(
    @Body(new ZodBodyPipe(loginRequestSchema)) input: LoginRequest,
    @Ip() ip: string,
  ): Promise<AuthResponse> {
    return this.auth.login(input, ip);
  }

  @Post("refresh")
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: "轮换刷新令牌" })
  @ApiBody({ schema: toOpenApiSchema(refreshRequestSchema, "input") })
  @ApiOkResponse({ schema: toOpenApiSchema(authResponseSchema) })
  @ApiUnauthorizedResponse({ description: "刷新令牌无效或已使用" })
  refresh(
    @Body(new ZodBodyPipe(refreshRequestSchema)) input: RefreshRequest,
    @Ip() ip: string,
  ): Promise<AuthResponse> {
    return this.auth.refresh(input, ip);
  }

  @Post("logout")
  @HttpCode(204)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "退出当前会话" })
  @ApiNoContentResponse({ description: "当前会话已撤销" })
  @ApiUnauthorizedResponse({ description: "需要有效的访问令牌" })
  async logout(@CurrentPrincipal() principal: AuthPrincipal): Promise<void> {
    await this.auth.logout(principal);
  }
}
