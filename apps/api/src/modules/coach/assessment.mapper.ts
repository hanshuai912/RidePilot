import { assessmentSchema } from "@ridepilot/contracts";
import type { TrainingAssessment } from "../../generated/prisma/client";
import { dbToDate } from "../training/training.validation";

export function assessmentResponse(item: TrainingAssessment) {
  return assessmentSchema.parse({
    ...item,
    localDate: dbToDate(item.localDate),
    actualDate: item.actualDate ? dbToDate(item.actualDate) : null,
    resultWatts: item.resultWatts === null ? null : Number(item.resultWatts),
    distanceKm: item.distanceKm === null ? null : Number(item.distanceKm),
    baselineFtpWatts:
      item.baselineFtpWatts === null ? null : Number(item.baselineFtpWatts),
  });
}
