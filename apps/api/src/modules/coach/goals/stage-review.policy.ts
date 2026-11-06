import { BadRequestException, ConflictException } from "@nestjs/common";
import type {
  StageReviewInput,
  StageReviewSnapshot,
} from "@ridepilot/contracts";

export function validateStageDecision(
  snapshot: StageReviewSnapshot,
  input: StageReviewInput,
) {
  if (snapshot.fingerprint !== input.fingerprint)
    throw new ConflictException({
      code: "STAGE_REVIEW_STALE",
      message: "阶段依据已变化，请刷新后重新预览",
    });
  if (input.outcome !== "INSUFFICIENT" && !snapshot.criteria)
    throw new BadRequestException({
      code: "STAGE_CRITERIA_REQUIRED",
      message: "请先保存可观察的阶段达成条件，或选择证据不足",
    });
  if (input.outcome === "MET" && snapshot.startDate > snapshot.localDate)
    throw new BadRequestException({
      code: "STAGE_NOT_STARTED",
      message: "阶段尚未开始，不能提前确认达成",
    });
  if (
    input.decision === "NEXT" &&
    (input.outcome !== "MET" ||
      !snapshot.nextStage ||
      snapshot.nextStage.endDate < snapshot.localDate ||
      snapshot.stale ||
      snapshot.goalStatus !== "ACTIVE")
  )
    throw new BadRequestException({
      code: "STAGE_NEXT_UNAVAILABLE",
      message:
        "进入下一阶段需确认达成、存在有效后续阶段且目标活跃；也可选择重新规划阶段",
    });
}
