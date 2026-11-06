import { toOpenApiSchema } from "../../../docs/zod-openapi";
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiAcceptedResponse,
  ApiHeader,
} from "@nestjs/swagger";
import {
  planImpactDecisionSchema,
  planImpactReferenceSchema,
  planImpactPreviewSchema,
  planImpactDecisionResponseSchema,
  generationResponseSchema,
  type PlanImpactDecision,
  type PlanImpactReference,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../../common/zod-body.pipe";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import type { AuthPrincipal } from "../../auth/auth.types";
import { AiGenerationService } from "../ai-generation.service";
import { PlanImpactService } from "./plan-impact.service";
import { assertPlanImpact } from "./plan-impact.repository";
import { PrismaService } from "../../../infra/prisma/prisma.service";

@ApiTags("plan-input-impact")
@ApiBearerAuth("access-token")
@Controller("plans/input-impact")
export class PlanImpactController {
  constructor(
    private readonly service: PlanImpactService,
    private readonly generations: AiGenerationService,
    private readonly prisma: PrismaService,
  ) {}
  @Get()
  @ApiOkResponse({ schema: toOpenApiSchema(planImpactPreviewSchema) })
  @ApiOperation({ summary: "查看资料变化、未来课程及处理记录" })
  preview(@CurrentPrincipal() p: AuthPrincipal) {
    return this.service.preview(p.userId);
  }

  @Post("decisions")
  @ApiBody({ schema: toOpenApiSchema(planImpactDecisionSchema, "input") })
  @ApiCreatedResponse({
    schema: toOpenApiSchema(planImpactDecisionResponseSchema),
  })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "保留原计划或创建 FTP 重算草稿" })
  decide(
    @CurrentPrincipal() p: AuthPrincipal,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(planImpactDecisionSchema)) input: PlanImpactDecision,
  ) {
    return this.service.decide(p.userId, input, key);
  }
  @Get("decisions/:id")
  @ApiOkResponse({ schema: toOpenApiSchema(planImpactDecisionResponseSchema) })
  get(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(p.userId, id);
  }

  @Post("decisions/:id/apply")
  @ApiCreatedResponse({
    schema: toOpenApiSchema(planImpactDecisionResponseSchema),
  })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "复核资料及反馈后确认发布 FTP 重算版本" })
  apply(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
  ) {
    return this.service.apply(p.userId, id, key);
  }

  @Post("generate-proposal")
  @ApiBody({ schema: toOpenApiSchema(planImpactReferenceSchema, "input") })
  @ApiAcceptedResponse({ schema: toOpenApiSchema(generationResponseSchema) })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @HttpCode(202)
  @ApiOperation({ summary: "按最新目标与可训练时间生成范围重排草稿" })
  async generate(
    @CurrentPrincipal() p: AuthPrincipal,
    @Headers("idempotency-key") key: string,
    @Body(new ZodBodyPipe(planImpactReferenceSchema))
    reference: PlanImpactReference,
  ) {
    const { preview } = await assertPlanImpact(
      this.prisma,
      p.userId,
      reference,
    );
    if (!preview.goalId)
      throw new ConflictException({
        code: "GOAL_REQUIRED",
        message: "请先选择或创建一个活跃目标",
      });
    return this.generations.submit(
      p.userId,
      {
        planImpact: reference,
        mode: "range",
        goalId: preview.goalId,
        weekStartDate: reference.startDate,
        endDate: reference.endDate,
        expectedBaseVersion: preview.basePlanVersion,
        notes: "根据最新资料重排所选范围的未来课程，保留已有实际训练记录。",
      },
      key,
      "RANGE_PLAN",
    );
  }
}
