import { BadRequestException, ConflictException } from "@nestjs/common";
import { ManualWorkoutDraft, WorkoutSegment } from "@ridepilot/contracts";

export function validateDraft(
  draft: ManualWorkoutDraft,
  hasFtp: boolean,
): { timeTargetMinutes: number | null; distanceTargetKm: number | null } {
  if (!hasFtp)
    throw new BadRequestException({
      code: "FTP_REQUIRED",
      message: "请先设置 FTP，再创建或调整训练",
    });
  if (draft.segments.length === 0) {
    throw new BadRequestException({
      code: "EMPTY_SEGMENTS",
      message: "课程至少需要一个动作",
    });
  }
  let time = 0;
  let distance = 0;
  for (const [index, segment] of draft.segments.entries()) {
    const repeat = segment.repeatCount ?? 1;
    if (segment.intensity.max < segment.intensity.min) {
      throw new BadRequestException({
        code: "INVALID_INTENSITY_RANGE",
        message: `第 ${index + 1} 个动作强度范围无效`,
      });
    }
    if (segment.target.kind === "duration")
      time += segment.target.value * repeat;
    else distance += segment.target.value * repeat;
  }
  return {
    timeTargetMinutes: time || null,
    distanceTargetKm: distance || null,
  };
}

export function assertPlanVersion(expected: number, actual: number): void {
  if (expected !== actual) {
    throw new ConflictException({
      code: "PLAN_VERSION_CONFLICT",
      message: "训练计划已被其他请求修改，请重新读取后再试",
    });
  }
}

export function assertEditableDate(
  scheduledDate: string,
  timezone: string,
): void {
  const now = new Date();
  const currentDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (scheduledDate < currentDate) {
    throw new ConflictException({
      code: "HISTORICAL_WORKOUT_NOT_EDITABLE",
      message: "历史训练计划不可编辑",
    });
  }
}

export function dateToDb(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function dbToDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function normalizeSegments(segments: WorkoutSegment) {
  return segments;
}
