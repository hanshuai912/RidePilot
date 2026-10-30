import { Controller, Get } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { homeTodayResponseSchema } from "@ridepilot/contracts";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import type { AuthPrincipal } from "../auth/auth.types";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import { HomeService } from "./home.service";

@ApiTags("home")
@ApiBearerAuth("access-token")
@Controller("home")
export class HomeController {
  constructor(private readonly service: HomeService) {}
  @Get("today")
  @ApiOperation({
    summary: "按账号时区读取首页今日训练和饮食，各区块独立报告失败",
  })
  @ApiOkResponse({ schema: toOpenApiSchema(homeTodayResponseSchema) })
  today(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.today(principal.userId);
  }
}
