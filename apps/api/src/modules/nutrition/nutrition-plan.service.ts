import { BadRequestException, Injectable } from "@nestjs/common";
import {
  NutritionPlanQuery,
  NutritionPlanResponse,
} from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { dateToDb } from "../training/training.validation";
import { NutritionRepository } from "./nutrition.repository";
import { toPlanResponse } from "./nutrition.mapper";

@Injectable()
export class NutritionPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: NutritionRepository,
  ) {}

  async get(
    userId: string,
    query: NutritionPlanQuery,
  ): Promise<NutritionPlanResponse> {
    const range = this.range(query);
    const [timezone, plan] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      }),
      this.repository.findActivePlan(userId),
    ]);
    return toPlanResponse(
      timezone?.timezone ?? "UTC",
      range.from,
      range.to,
      plan,
    );
  }

  private range(query: NutritionPlanQuery): { from: string; to: string } {
    if (query.date) return { from: query.date, to: query.date };
    if (!query.from || !query.to)
      throw new BadRequestException({
        code: "NUTRITION_DATE_INVALID",
        message: "请提供有效的日期范围",
      });
    const days =
      (dateToDb(query.to).getTime() - dateToDb(query.from).getTime()) /
        (24 * 60 * 60 * 1000) +
      1;
    if (days > 31)
      throw new BadRequestException({
        code: "NUTRITION_DATE_RANGE_TOO_LARGE",
        message: "一次最多查询 31 天的饮食计划",
      });
    return { from: query.from, to: query.to };
  }
}
