import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  dismissCoachSuggestionSchema,
  type DismissCoachSuggestion,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { CoachOverviewService } from "./coach-overview.service";
import { CoachSuggestionsService } from "./coach-suggestions.service";

@ApiTags("ai-coach")
@ApiBearerAuth("access-token")
@Controller("ai-coach")
export class CoachCenterController {
  constructor(
    private readonly overview: CoachOverviewService,
    private readonly suggestions: CoachSuggestionsService,
  ) {}
  @Get("overview")
  get(@CurrentPrincipal() p: AuthPrincipal) {
    return this.overview.get(p.userId);
  }
  @Get("suggestions")
  list(@CurrentPrincipal() p: AuthPrincipal) {
    return this.suggestions.list(p.userId);
  }
  @Post("suggestions/:id/dismiss")
  dismiss(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(dismissCoachSuggestionSchema))
    input: DismissCoachSuggestion,
  ) {
    return this.suggestions.dismiss(p.userId, id, input);
  }
}
