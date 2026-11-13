import { BadRequestException, ConflictException } from "@nestjs/common";
import type { StageReviewEvidence } from "@ridepilot/contracts";

export function assertStageReviewScope(
  review: StageReviewEvidence,
  input: {
    goalId: string;
    stageId?: string;
    weekStartDate?: string;
    endDate?: string;
  },
  roadmap = false,
) {
  const s = review.snapshot;
  if (s.goalId !== input.goalId || s.goalStatus !== "ACTIVE")
    throw new ConflictException({
      code: "STAGE_REVIEW_GOAL_CONFLICT",
      message: "请选择复评对应的活跃目标",
    });
  if (roadmap) {
    if (!["EXTEND", "ADJUST"].includes(review.decision))
      throw new BadRequestException({
        code: "STAGE_REVIEW_SCOPE",
        message: "此复评选择用于后续课程，重新安排阶段请先选择延长或调整阶段",
      });
    return;
  }
  if (s.stale || review.decision === "EXTEND")
    throw new ConflictException({
      code: "STAGE_REVIEW_SCOPE",
      message: "请先重新规划并确认阶段，再生成具体课程",
    });
  if (review.decision === "KEEP" && s.endDate < s.localDate)
    throw new ConflictException({
      code: "STAGE_REVIEW_SCOPE",
      message: "本阶段日程已结束，请选择延长或调整后续安排",
    });
  const expectedStage =
    review.decision === "NEXT" ? s.nextStage?.id : s.stageId;
  if (review.decision !== "ADJUST" && input.stageId !== expectedStage)
    throw new BadRequestException({
      code: "STAGE_REVIEW_SCOPE",
      message: "课程范围必须与已确认的阶段决定一致",
    });
  if (input.weekStartDate && input.weekStartDate < s.localDate)
    throw new BadRequestException({
      code: "STAGE_REVIEW_SCOPE",
      message: "后续课程须从今天或未来开始",
    });
}
