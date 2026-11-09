import { Injectable } from "@nestjs/common";
import { homeActionsSchema } from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { CoachOverviewService } from "../coach/coach-overview.service";
import { CoachSuggestionsService } from "../coach/coach-suggestions.service";
import { dateToDb, dbToDate } from "../training/training.validation";

@Injectable()
export class HomeActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly overview: CoachOverviewService,
    private readonly suggestions: CoachSuggestionsService,
  ) {}
  async get(userId: string, localDate: string) {
    const [overview, suggestions, race] = await Promise.all([
      this.overview.get(userId),
      this.suggestions.list(userId),
      this.prisma.trainingRace.findFirst({
        where: {
          userId,
          status: "CONFIRMED",
          localDate: { gte: dateToDb(localDate) },
        },
        orderBy: [{ localDate: "asc" }, { priority: "asc" }],
      }),
    ]);
    return homeActionsSchema.parse({
      overview,
      suggestions: suggestions.pending,
      nextRace: race
        ? {
            id: race.id,
            date: dbToDate(race.localDate),
            title: race.name,
            priority: race.priority,
          }
        : null,
    });
  }
}
