import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  cycleReviewGenerationSchema,
  cycleReviewRangeSchema,
  type CycleReviewGeneration,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../../common/zod-body.pipe";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import type { AuthPrincipal } from "../../auth/auth.types";
import { CycleReviewService } from "./cycle-review.service";

@ApiTags("ai-coach")
@ApiBearerAuth("access-token")
@Controller("ai-coach/cycle-review")
export class CycleReviewController {
  constructor(private readonly reviews: CycleReviewService) {}
  @Get()
  get(
    @CurrentPrincipal() p: AuthPrincipal,
    @Query() query: Record<string, unknown>,
  ) {
    if (!Object.keys(query).length) return this.reviews.get(p.userId);
    const parsed = cycleReviewRangeSchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException({
        code: "INVALID_REVIEW_RANGE",
        message: "请填写有效的复盘起止日期",
      });
    return this.reviews.get(p.userId, parsed.data);
  }
  @Get("history")
  history(@CurrentPrincipal() p: AuthPrincipal) {
    return this.reviews.history(p.userId);
  }
  @Post("generate-proposal")
  @HttpCode(202)
  generate(
    @CurrentPrincipal() p: AuthPrincipal,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(cycleReviewGenerationSchema))
    input: CycleReviewGeneration,
  ) {
    return this.reviews.generate(p.userId, input, key);
  }
}
