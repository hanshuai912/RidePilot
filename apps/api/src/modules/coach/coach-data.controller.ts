import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  availabilityInputSchema,
  ftpMeasurementInputSchema,
  goalInputSchema,
  goalPatchSchema,
  type AvailabilityInput,
  type FtpMeasurementInput,
  type GoalInput,
  type GoalPatch,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { CoachDataService } from "./coach-data.service";

@ApiTags("coach-data")
@ApiBearerAuth("access-token")
@Controller()
export class CoachDataController {
  constructor(private readonly data: CoachDataService) {}

  @Get("me/ability-measurements/ftp")
  getFtp(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.data.getFtp(principal.userId);
  }

  @Post("me/ability-measurements/ftp")
  addFtp(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(ftpMeasurementInputSchema))
    input: FtpMeasurementInput,
  ) {
    return this.data.addFtp(principal.userId, input);
  }

  @Get("me/availability")
  getAvailability(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.data.getAvailability(principal.userId);
  }

  @Put("me/availability")
  putAvailability(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(availabilityInputSchema)) input: AvailabilityInput,
  ) {
    return this.data.putAvailability(principal.userId, input);
  }

  @Get("goals")
  listGoals(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.data.listGoals(principal.userId);
  }

  @Post("goals")
  createGoal(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body(new ZodBodyPipe(goalInputSchema)) input: GoalInput,
  ) {
    return this.data.createGoal(principal.userId, input);
  }

  @Get("goals/:id")
  getGoal(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("id") id: string,
  ) {
    return this.data.getGoal(principal.userId, id).then((goal) => ({
      id: goal.id,
      type: goal.type,
      description: goal.description,
      targetWkg: goal.targetWkg ? Number(goal.targetWkg) : null,
      targetDate: goal.targetDate.toISOString().slice(0, 10),
      priority: goal.priority,
      status: goal.status,
      version: goal.version,
    }));
  }

  @Patch("goals/:id")
  patchGoal(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodBodyPipe(goalPatchSchema)) input: GoalPatch,
  ) {
    return this.data.patchGoal(principal.userId, id, input);
  }

  @Get("ai-coach/readiness")
  readiness(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.data.readiness(principal.userId);
  }

  @Get("plans/active/status")
  async planStatus(@CurrentPrincipal() principal: AuthPrincipal) {
    const plan = await this.data.activePlan(principal.userId);
    return {
      hasActivePlan: Boolean(plan?.activeVersion),
      planVersion: plan?.activeVersion?.versionNo ?? 0,
    };
  }
}
