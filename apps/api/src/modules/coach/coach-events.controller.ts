import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  activityInputSchema,
  raceInputSchema,
  racePatchSchema,
  raceResultInputSchema,
  type ActivityInput,
  type RaceInput,
  type RacePatch,
  type RaceResultInput,
} from "@ridepilot/contracts";
import { ZodBodyPipe } from "../../common/zod-body.pipe";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { CoachEventsService } from "./coach-events.service";

@ApiTags("training-events")
@ApiBearerAuth("access-token")
@Controller()
export class CoachEventsController {
  constructor(private readonly events: CoachEventsService) {}

  @Get("activities")
  activities(@CurrentPrincipal() user: AuthPrincipal) {
    return this.events.listActivities(user.userId);
  }

  @Post("activities")
  activity(
    @CurrentPrincipal() user: AuthPrincipal,
    @Body(new ZodBodyPipe(activityInputSchema)) input: ActivityInput,
  ) {
    return this.events.recordActivity(user.userId, input);
  }

  @Get("races")
  races(@CurrentPrincipal() user: AuthPrincipal) {
    return this.events.listRaces(user.userId);
  }

  @Get("races/:id/impact-preview")
  impactPreview(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id") id: string,
  ) {
    return this.events.impactPreview(user.userId, id);
  }

  @Post("races")
  race(
    @CurrentPrincipal() user: AuthPrincipal,
    @Body(new ZodBodyPipe(raceInputSchema)) input: RaceInput,
  ) {
    return this.events.createRace(user.userId, input);
  }

  @Get("races/:id")
  async getRace(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id") id: string,
  ) {
    const item = await this.events.getRace(user.userId, id);
    return {
      id: item.id,
      name: item.name,
      localDate: item.localDate.toISOString().slice(0, 10),
      timezone: item.timezone,
      distanceKm: Number(item.distanceKm),
      type: item.type,
      elevationGainM: item.elevationGainM,
      priority: item.priority,
      intent: item.intent,
      status: item.status,
      version: item.version,
    };
  }

  @Patch("races/:id")
  patchRace(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodBodyPipe(racePatchSchema)) input: RacePatch,
  ) {
    return this.events.patchRace(user.userId, id, input);
  }

  @Get("races/:id/result")
  getResult(@CurrentPrincipal() user: AuthPrincipal, @Param("id") id: string) {
    return this.events.getRaceResult(user.userId, id);
  }

  @Post("races/:id/result")
  saveResult(
    @CurrentPrincipal() user: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodBodyPipe(raceResultInputSchema)) input: RaceResultInput,
  ) {
    return this.events.saveRaceResult(user.userId, id, input);
  }
}
