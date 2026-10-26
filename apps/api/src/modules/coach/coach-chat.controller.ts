import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  coachChatInputSchema,
  type CoachChatInput,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { CoachChatService } from "./coach-chat.service";

@ApiTags("ai-coach")
@ApiBearerAuth("access-token")
@Controller()
export class CoachChatController {
  constructor(private readonly chat: CoachChatService) {}

  @Post("ai-coach/chat")
  explain(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(coachChatInputSchema)) input: CoachChatInput,
  ) {
    return this.chat.explain(principal.userId, input);
  }
}
