import { toOpenApiSchema } from "../../docs/zod-openapi";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiConflictResponse,
} from "@nestjs/swagger";
import { z } from "zod";
import {
  assessmentSchema,
  assessmentReviewSchema,
  assessmentPreviewSchema,
  assessmentInputSchema,
  assessmentPatchSchema,
  assessmentPreviewInputSchema,
  assessmentFtpInputSchema,
  type AssessmentInput,
  type AssessmentPatch,
  type AssessmentPreviewInput,
  type AssessmentFtpInput,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { assessmentResponse } from "./assessment.mapper";
import { AssessmentScheduleService } from "./assessment-schedule.service";
import { AssessmentReviewService } from "./assessment-review.service";
import { AssessmentsService } from "./assessments.service";

@ApiTags("assessments")
@ApiBearerAuth("access-token")
@Controller("assessments")
export class AssessmentsController {
  constructor(
    private readonly assessments: AssessmentsService,
    private readonly schedules: AssessmentScheduleService,
    private readonly reviews: AssessmentReviewService,
  ) {}

  @Get()
  @ApiOkResponse({ schema: toOpenApiSchema(z.array(assessmentSchema)) })
  list(@CurrentPrincipal() user: AuthPrincipal, @Query() query: unknown) {
    const parsed = z
      .strictObject({
        goalId: z.uuid().optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
      })
      .safeParse(query);
    if (
      !parsed.success ||
      (parsed.data.from &&
        parsed.data.to &&
        (parsed.data.from > parsed.data.to ||
          Date.parse(parsed.data.to) - Date.parse(parsed.data.from) >
            366 * 86400000))
    )
      throw new BadRequestException({
        code: "INVALID_ASSESSMENT_QUERY",
        message: "测试查询日期无效或范围超过一年",
      });
    return this.assessments.list(user.userId, parsed.data);
  }

  @Post("schedule-preview")
  @ApiBody({ schema: toOpenApiSchema(assessmentPreviewInputSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(assessmentPreviewSchema) })
  preview(
    @CurrentPrincipal() user: AuthPrincipal,
    @Body(new ZodBodyPipe(assessmentPreviewInputSchema))
    input: AssessmentPreviewInput,
  ) {
    return this.schedules.preview(user.userId, input);
  }

  @Post()
  @ApiBody({ schema: toOpenApiSchema(assessmentInputSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(assessmentSchema) })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiConflictResponse({ description: "预览过期、冲突未确认或幂等键重复使用" })
  create(
    @CurrentPrincipal() user: AuthPrincipal,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(assessmentInputSchema)) input: AssessmentInput,
  ) {
    return this.assessments.create(user.userId, input, key);
  }

  @Get(":id")
  @ApiOkResponse({ schema: toOpenApiSchema(assessmentSchema) })
  async get(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return assessmentResponse(await this.assessments.get(user.userId, id));
  }

  @Get(":id/review")
  @ApiOkResponse({ schema: toOpenApiSchema(assessmentReviewSchema) })
  review(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.reviews.review(user.userId, id);
  }

  @Patch(":id")
  @ApiBody({ schema: toOpenApiSchema(assessmentPatchSchema, "input") })
  @ApiOkResponse({ schema: toOpenApiSchema(assessmentSchema) })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiConflictResponse({ description: "测试版本、状态或改期预览已变化" })
  patch(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(assessmentPatchSchema)) input: AssessmentPatch,
  ) {
    return this.assessments.patch(user.userId, id, input, key);
  }

  @Post(":id/ftp-confirmation")
  @ApiBody({ schema: toOpenApiSchema(assessmentFtpInputSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(assessmentSchema) })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiConflictResponse({
    description: "测试或当前 FTP 已变化，或结果不可用于更新 FTP",
  })
  ftp(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(assessmentFtpInputSchema)) input: AssessmentFtpInput,
  ) {
    return this.assessments.updateFtp(user.userId, id, input, key);
  }
}
