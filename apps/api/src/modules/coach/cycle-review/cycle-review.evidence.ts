import { BadRequestException, ConflictException } from "@nestjs/common";
import type { AiWeekOutput, CycleReviewReference } from "@ridepilot/contracts";
import type { Prisma } from "../../../generated/prisma/client";
import { buildCycleReview } from "./cycle-review.policy";
import { readCycleReviewData } from "./cycle-review.repository";

export const cycleReviewStaleReason =
  "周期复盘依据已变化，请刷新复盘并重新生成";

export async function resolveCycleReview(
  db: Prisma.TransactionClient,
  userId: string,
  reference: CycleReviewReference,
) {
  const snapshot = buildCycleReview(
    await readCycleReviewData(db, userId, reference),
  );
  if (snapshot.fingerprint !== reference.fingerprint)
    throw new ConflictException({
      code: "CYCLE_REVIEW_STALE",
      message: cycleReviewStaleReason,
    });
  return { action: reference.action, snapshot };
}

// Recovery applies to every segment, including warmups and cooldowns. Recheck
// after manual edits too; a prompt alone cannot enforce the chosen action.
export function validateCycleRecovery(
  output: AiWeekOutput,
  ftpWatts: number,
  action?: string,
) {
  if (action !== "RECOVERY") return;
  for (const workout of output.workouts)
    for (const segment of workout.segments) {
      const upper =
        segment.intensity.kind === "ftp_percent"
          ? segment.intensity.max
          : (segment.intensity.max / ftpWatts) * 100;
      if (upper > 70)
        throw new BadRequestException({
          code: "CYCLE_RECOVERY_INTENSITY",
          message: "恢复草稿所有区段须不高于 70% FTP，请降低强度后再校验",
        });
    }
}
