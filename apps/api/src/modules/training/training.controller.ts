import { TrainingCalendarService } from "./training-calendar.service";
import { TrainingHistoryService } from "./training-history.service";
import {
  trainingHistoryResponseSchema,
  workoutSummarySchema,
} from "@ridepilot/contracts";
import { WorkoutRescheduleService } from "./workout-reschedule.service";
import {
  rescheduleInputSchema,
  reschedulePreviewSchema,
  type RescheduleInput,
} from "@ridepilot/contracts";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  applyProposalSchema,
  applyProposalResponseSchema,
  calendarResponseSchema,
  nextWorkoutResponseSchema,
  createManualWorkoutProposalSchema,
  editWorkoutProposalSchema,
  proposalResponseSchema,
  aiProposalResponseSchema,
  restoreProposalResponseSchema,
  updateProposalSchema,
  CreateManualWorkoutProposal,
  EditWorkoutProposal,
  UpdateProposal,
  ApplyProposal,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { toOpenApiSchema } from "../../docs/zod-openapi";
import { AuthPrincipal } from "../auth/auth.types";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import { TrainingService } from "./training.service";

@ApiTags("training")
@ApiBearerAuth("access-token")
@Controller()
export class TrainingController {
  constructor(
    private readonly service: TrainingService,
    private readonly reschedules: WorkoutRescheduleService,
    private readonly calendar: TrainingCalendarService,
    private readonly history: TrainingHistoryService,
  ) {}

  @Post("workouts/manual-proposals")
  @ApiOperation({ summary: "创建手动骑行课程草稿，支持尚无正式计划的首次创建" })
  @ApiBody({
    schema: toOpenApiSchema(createManualWorkoutProposalSchema, "input"),
  })
  @ApiCreatedResponse({ schema: toOpenApiSchema(proposalResponseSchema) })
  createManual(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(createManualWorkoutProposalSchema))
    input: CreateManualWorkoutProposal,
  ) {
    return this.service.createManualProposal(principal.userId, input);
  }

  @Post("workouts/:workoutId/edit-proposal")
  @ApiOperation({ summary: "为当天或未来课程创建编辑草稿" })
  @ApiBody({ schema: toOpenApiSchema(editWorkoutProposalSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(proposalResponseSchema) })
  edit(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("workoutId") workoutId: string,
    @Body(new ZodBodyPipe(editWorkoutProposalSchema))
    input: EditWorkoutProposal,
  ) {
    return this.service.createEditProposal(principal.userId, workoutId, input);
  }

  @Get("proposals/:proposalId")
  @ApiOkResponse({
    schema: {
      oneOf: [
        toOpenApiSchema(proposalResponseSchema),
        toOpenApiSchema(aiProposalResponseSchema),
        toOpenApiSchema(restoreProposalResponseSchema),
      ],
    },
  })
  getProposal(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("proposalId") proposalId: string,
  ) {
    return this.service.getProposal(principal.userId, proposalId);
  }

  @Patch("proposals/:proposalId")
  @ApiBody({ schema: toOpenApiSchema(updateProposalSchema, "input") })
  @ApiOkResponse({ schema: toOpenApiSchema(proposalResponseSchema) })
  update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("proposalId") proposalId: string,
    @Body(new ZodBodyPipe(updateProposalSchema)) input: UpdateProposal,
  ) {
    return this.service.updateProposal(principal.userId, proposalId, input);
  }

  @Post("proposals/:proposalId/validate")
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        toOpenApiSchema(proposalResponseSchema),
        toOpenApiSchema(aiProposalResponseSchema),
        toOpenApiSchema(restoreProposalResponseSchema),
      ],
    },
  })
  validate(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("proposalId") proposalId: string,
  ) {
    return this.service.validateProposal(principal.userId, proposalId);
  }

  @Post("proposals/:proposalId/apply")
  @ApiOperation({ summary: "确认应用人工课程；无正式计划时创建第 1 版" })
  @ApiBody({ schema: toOpenApiSchema(applyProposalSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(applyProposalResponseSchema) })
  apply(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("proposalId") proposalId: string,
    @Headers("idempotency-key") idempotencyKey: string,
    @Body(new ZodBodyPipe(applyProposalSchema)) input: ApplyProposal,
  ) {
    return this.service.applyProposal(
      principal.userId,
      proposalId,
      input,
      idempotencyKey,
    );
  }

  @Post("workouts/:workoutId/reschedule-preview")
  @ApiBody({ schema: toOpenApiSchema(rescheduleInputSchema, "input") })
  @ApiCreatedResponse({ schema: toOpenApiSchema(reschedulePreviewSchema) })
  reschedule(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("workoutId") workoutId: string,
    @Body(new ZodBodyPipe(rescheduleInputSchema)) input: RescheduleInput,
  ) {
    return this.reschedules.preview(principal.userId, workoutId, input);
  }

  @Get("workouts/next")
  @ApiOperation({ summary: "读取当前用户当地今天起下一节尚未记录的正式课程" })
  @ApiOkResponse({ schema: toOpenApiSchema(nextWorkoutResponseSchema) })
  async nextWorkout(@CurrentPrincipal() principal: AuthPrincipal) {
    return { workout: await this.service.nextWorkout(principal.userId) };
  }

  @Get("workouts/history")
  @ApiOperation({ summary: "按日期倒序分页读取本人截至今天的训练历史" })
  @ApiOkResponse({ schema: toOpenApiSchema(trainingHistoryResponseSchema) })
  getHistory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query("cursor") cursor?: string,
  ) {
    return this.history.list(principal.userId, cursor);
  }

  @Get("workouts/history/:workoutId")
  @ApiOperation({ summary: "只读查看本人历史训练，包含已有反馈的旧版课程" })
  @ApiOkResponse({ schema: toOpenApiSchema(workoutSummarySchema) })
  getHistoryWorkout(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("workoutId") workoutId: string,
  ) {
    return this.history.detail(principal.userId, workoutId);
  }

  @Get("workouts/:workoutId")
  @ApiOkResponse({
    schema: toOpenApiSchema(proposalResponseSchema.shape.draftWorkout),
  })
  getWorkout(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("workoutId") workoutId: string,
  ) {
    return this.service.getWorkout(principal.userId, workoutId);
  }

  @Get("calendar")
  @ApiOkResponse({ schema: toOpenApiSchema(calendarResponseSchema) })
  getCalendar(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.calendar.get(principal.userId, from, to);
  }
}
