import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseFilters,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  coachChatInputSchema,
  type CoachChatInput,
  sendCoachChatSchema,
  coachChatHistoryQuerySchema,
  type SendCoachChat,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { CoachChatService } from "./coach-chat.service";
import { AiExceptionFilter } from "../../ai/exceptions/ai-exception.filter";
import { CoachChatHistoryService } from "./coach-chat-history.service";

@ApiTags("ai-coach")
@ApiBearerAuth("access-token")
@Controller()
export class CoachChatController {
  constructor(
    private readonly chat: CoachChatService,
    private readonly history: CoachChatHistoryService,
  ) {}

  @Get("ai-coach/chat/messages")
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: Record<string, unknown>,
  ) {
    const input = new ZodBodyPipe(coachChatHistoryQuerySchema).transform(query);
    return this.history.history(principal.userId, input.before);
  }

  @Post("ai-coach/chat/messages")
  send(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(sendCoachChatSchema)) input: SendCoachChat,
  ) {
    return this.history.send(principal.userId, input);
  }

  @Get("ai-coach/chat/messages/:clientMessageId")
  async find(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("clientMessageId") clientMessageId: string,
  ) {
    return { turn: await this.history.find(principal.userId, clientMessageId) };
  }

  @Post("ai-coach/chat")
  @UseFilters(AiExceptionFilter)
  explain(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(coachChatInputSchema)) input: CoachChatInput,
  ) {
    return this.chat.explain(principal.userId, input);
  }
}
