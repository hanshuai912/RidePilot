import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  NutritionProfileInput,
  NutritionProfileResponse,
} from "@ridepilot/contracts";
import { Prisma } from "../../generated/prisma/client";
import { NutritionRepository } from "./nutrition.repository";
import { toProfileResponse } from "./nutrition.mapper";

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class NutritionProfileService {
  constructor(private readonly repository: NutritionRepository) {}

  async get(userId: string): Promise<NutritionProfileResponse> {
    const profile = await this.repository.findProfile(userId);
    if (!profile)
      throw new NotFoundException({
        code: "NUTRITION_PROFILE_NOT_FOUND",
        message: "尚未建立饮食档案",
      });
    return toProfileResponse(profile);
  }

  async put(userId: string, input: NutritionProfileInput) {
    const current = await this.repository.findProfile(userId);
    if (!current) {
      if (input.expectedVersion !== undefined && input.expectedVersion !== 0)
        throw new ConflictException({
          code: "NUTRITION_VERSION_CONFLICT",
          message: "饮食档案版本已改变，请重新读取后再提交",
        });
      await this.repository.createProfile(userId, {
        dietStyle: input.dietStyle,
        habits: json(input.habits),
        allergens: json(input.allergens),
        restrictions: json(input.restrictions),
        restrictionNote: input.restrictionNote ?? null,
        commonFoods: json(input.commonFoods),
        mealSchedule: json(input.mealSchedule),
      });
      return this.get(userId);
    }

    if (input.expectedVersion === undefined)
      throw new ConflictException({
        code: "NUTRITION_VERSION_REQUIRED",
        message: "更新饮食档案时必须提供 expectedVersion",
      });
    const updated = await this.repository.updateProfile(
      userId,
      input.expectedVersion,
      {
        dietStyle: input.dietStyle,
        habits: json(input.habits),
        allergens: json(input.allergens),
        restrictions: json(input.restrictions),
        restrictionNote: input.restrictionNote ?? null,
        commonFoods: json(input.commonFoods),
        mealSchedule: json(input.mealSchedule),
      },
    );
    if (!updated.count)
      throw new ConflictException({
        code: "NUTRITION_VERSION_CONFLICT",
        message: "饮食档案已被其他请求修改，请重新读取后再提交",
      });
    return this.get(userId);
  }
}
