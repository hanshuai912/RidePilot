import { Injectable, Logger } from "@nestjs/common";
import {
  homeTodayResponseSchema,
  type HomeTodayResponse,
} from "@ridepilot/contracts";
import { NutritionPlanService } from "../nutrition/nutrition-plan.service";
import { ProfileService } from "../profile/profile.service";
import { TrainingOverviewService } from "../training/training-overview.service";

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);
  constructor(
    private readonly profiles: ProfileService,
    private readonly training: TrainingOverviewService,
    private readonly nutrition: NutritionPlanService,
  ) {}

  async today(userId: string): Promise<HomeTodayResponse> {
    const profile = await this.profiles.get(userId);
    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: profile.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [training, nutrition] = await Promise.all([
      this.section(
        "HOME_TRAINING_UNAVAILABLE",
        "训练安排暂时无法读取，请重试",
        () => this.training.today(userId, localDate),
      ),
      this.section(
        "HOME_NUTRITION_UNAVAILABLE",
        "饮食安排暂时无法读取，请重试",
        () => this.nutrition.get(userId, { date: localDate }),
      ),
    ]);
    return homeTodayResponseSchema.parse({
      localDate,
      profile,
      training,
      nutrition,
    });
  }

  private async section<T>(
    code: string,
    message: string,
    read: () => Promise<T>,
  ) {
    try {
      return { status: "READY" as const, data: await read() };
    } catch {
      this.logger.warn({ code });
      return { status: "UNAVAILABLE" as const, error: { code, message } };
    }
  }
}
