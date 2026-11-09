import { parseTrainingAvailability } from "./training-availability";
import { Injectable, BadRequestException } from "@nestjs/common";
import {
  calendarResponseSchema,
  type CalendarResponse,
} from "@ridepilot/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TrainingRepository } from "./training.repository";
import { calendarEvents } from "./calendar-events";
import { toSummary } from "./training.mapper";
import { dateToDb, dbToDate } from "./training.validation";
@Injectable()
export class TrainingCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: TrainingRepository,
  ) {}
  async get(
    userId: string,
    from: string,
    to: string,
  ): Promise<CalendarResponse> {
    if (
      !calendarResponseSchema.shape.from.safeParse(from).success ||
      !calendarResponseSchema.shape.to.safeParse(to).success ||
      from > to ||
      dateToDb(to).getTime() - dateToDb(from).getTime() > 92 * 86400000
    )
      throw new BadRequestException({
        code: "INVALID_DATE_RANGE",
        message: "请选择有效且不超过 93 天的日历范围",
      });
    const items = await this.repository.findCalendar(
      userId,
      dateToDb(from),
      dateToDb(to),
    );
    const [timezone, activities] = await Promise.all([
      this.prisma.user
        .findUniqueOrThrow({
          where: { id: userId },
          select: { timezone: true },
        })
        .then((u) => u.timezone),
      this.repository.activities(userId, items),
    ]);
    const currentDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
    }).format(new Date());
    const availability = parseTrainingAvailability(
      await this.prisma.trainingAvailability.findUnique({ where: { userId } }),
    );
    const summaries = items.map((item) =>
      toSummary({
        ...item,
        activity: activities.get(item.id) ?? null,
        editable:
          dbToDate(item.scheduledDate) >= currentDate &&
          !activities.has(item.id),
      }),
    );
    const ftp = await this.prisma.abilityMeasurement.findFirst({
      where: { userId, metricType: "FTP", unit: "W" },
      orderBy: { measuredAt: "desc" },
    });
    return {
      timezone,
      localDate: currentDate,
      events: calendarEvents(
        from,
        to,
        availability.success ? availability.data.weekdays : null,
        summaries,
      ),
      from,
      to,
      ftpAvailable: Boolean(ftp && Number(ftp.value) > 0),
      items: summaries,
    };
  }
}
