import { BadRequestException } from "@nestjs/common";
import {
  stagePlanOutputSchema,
  type StagePlanOutput,
} from "@ridepilot/contracts";

export function assertDateRange(start: string, end: string, maxDays: number) {
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
  if (!Number.isInteger(days) || days < 1 || days > maxDays)
    throw new BadRequestException({
      code: "INVALID_DATE_RANGE",
      message: `请选择连续 1–${maxDays} 天的日期范围`,
    });
}

export function validateStages(
  raw: unknown,
  start: string,
  end: string,
): StagePlanOutput {
  const parsed = stagePlanOutputSchema.safeParse(raw);
  if (!parsed.success)
    throw new BadRequestException({
      code: "AI_OUTPUT_INVALID",
      message: "阶段结构无效",
    });
  const output = parsed.data;
  let next = start;
  for (const stage of output.stages) {
    assertDateRange(stage.startDate, stage.endDate, 84);
    if (stage.startDate !== next || stage.endDate > end)
      throw new BadRequestException({
        code: "AI_OUTPUT_INVALID",
        message: "阶段日期必须连续、不重叠并覆盖所选范围",
      });
    next = new Date(Date.parse(stage.endDate) + 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  if (output.stages.at(-1)?.endDate !== end)
    throw new BadRequestException({
      code: "AI_OUTPUT_INVALID",
      message: "阶段未覆盖完整范围",
    });
  return output;
}
