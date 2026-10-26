import { Body, Controller, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  updateAiProposalSchema,
  type UpdateAiProposal,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { CoachProposalService } from "./coach-proposal.service";

@ApiTags("ai-coach")
@ApiBearerAuth("access-token")
@Controller()
export class AiProposalController {
  constructor(private readonly proposals: CoachProposalService) {}

  @Patch("ai-coach/proposals/:id")
  update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodBodyPipe(updateAiProposalSchema)) input: UpdateAiProposal,
  ) {
    return this.proposals.update(principal.userId, id, input);
  }
}
