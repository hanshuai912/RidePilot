import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { restoreProposalInputSchema } from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { PlanRestoreService } from "./plan-restore.service";

@ApiTags("training")
@ApiBearerAuth("access-token")
@Controller()
export class PlanRestoreController {
  constructor(private readonly restore: PlanRestoreService) {}

  @Get("plans/versions")
  list(@CurrentPrincipal() user: AuthPrincipal) {
    return this.restore.listVersions(user.userId);
  }

  @Get("plans/versions/:id")
  get(@CurrentPrincipal() user: AuthPrincipal, @Param("id") id: string) {
    return this.restore.getVersion(user.userId, id);
  }

  @Post("plans/versions/:id/restore-proposal")
  create(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodBodyPipe(restoreProposalInputSchema))
    input: { expectedBaseVersion: number },
  ) {
    return this.restore.create(user.userId, id, input.expectedBaseVersion);
  }
}
