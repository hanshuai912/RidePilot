import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  nutritionPlanQuerySchema,
  NutritionPlanQuery,
} from "@ridepilot/contracts";
import { CurrentPrincipal } from "../auth/current-principal.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { NutritionPlanService } from "./nutrition-plan.service";

@ApiTags("nutrition")
@ApiBearerAuth("access-token")
@Controller("nutrition/plan")
export class NutritionPlanController {
  constructor(private readonly service: NutritionPlanService) {}

  @Get()
  get(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: Record<string, string | undefined>,
  ) {
    const parsed = nutritionPlanQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "请求参数无效",
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    return this.service.get(
      principal.userId,
      parsed.data as NutritionPlanQuery,
    );
  }
}
