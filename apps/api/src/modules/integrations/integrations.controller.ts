import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/public.decorator";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { IntegrationsService } from "./integrations.service";

@ApiTags("integrations")
@ApiBearerAuth("access-token")
@Controller()
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get("integrations/providers")
  listProviders() {
    return this.service.listProviders();
  }

  @Get("me/integrations")
  listConnections(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.listConnections(principal.userId);
  }

  @Post("me/integrations/:provider/authorization")
  authorize(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("provider") provider: string,
  ) {
    return this.service.createAuthorization(principal.userId, provider);
  }

  @Public()
  @Get("integrations/oauth/callback/:provider")
  async callback(
    @Param("provider") provider: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() response: { redirect: (status: number, url: string) => void },
  ) {
    const redirect = await this.service.handleCallback(provider, {
      code,
      state,
      error,
    });
    return response.redirect(302, redirect);
  }

  @Delete("me/integrations/:connectionId")
  disconnect(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("connectionId") connectionId: string,
  ) {
    return this.service.disconnect(principal.userId, connectionId);
  }

  @Post("me/integrations/:connectionId/probe")
  probe(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("connectionId") connectionId: string,
  ) {
    return this.service.probe(principal.userId, connectionId);
  }
}
