import { BadRequestException, ConflictException } from "@nestjs/common";
import type { AssessmentPatch } from "@ridepilot/contracts";
import type { TrainingAssessment } from "../../generated/prisma/client";

export function validateAssessmentResult(
  current: TrainingAssessment,
  input: AssessmentPatch,
  today: string,
) {
  if (
    !["SCHEDULED", "POSTPONED", "INCOMPLETE"].includes(current.status) &&
    !(current.status === "COMPLETED" && input.status === "INVALID")
  )
    throw new ConflictException({
      code: "ASSESSMENT_NOT_EDITABLE",
      message: "测试已结束，不能重复录入或改期",
    });
  if (
    current.kind === "LEGACY" &&
    !["SKIPPED", "INVALID"].includes(input.status)
  )
    throw new BadRequestException({
      code: "LEGACY_ASSESSMENT",
      message: "旧版测试请跳过或作废后重新安排",
    });
  const fail = (message: string) => {
    throw new BadRequestException({
      code: "INVALID_ASSESSMENT_RESULT",
      message,
    });
  };
  if (input.status !== "COMPLETED" && !input.reason?.trim())
    fail("请填写改期、跳过、未完成或无效的原因");
  if (input.status === "POSTPONED") {
    if (!input.localDate) fail("请选择新的测试日期");
    return;
  }
  if (["COMPLETED", "INCOMPLETE"].includes(input.status)) {
    if (!input.actualDate || input.actualDate > today)
      fail("请填写今天或过去的实际测试日期");
  }
  if (input.status !== "COMPLETED") return;
  if (current.kind === "LEGACY") fail("旧版测试缺少测试类型，请重新安排后录入");
  if (!input.source || !input.rpe || !input.protocol)
    fail("请填写测试方法、结果来源和 RPE（1–10）");
  if (
    current.kind === "FTP" &&
    (!input.resultWatts || input.resultWatts < 50 || input.resultWatts > 800)
  )
    fail("FTP 结果需为 50–800 W 的最终 FTP 数值");
  if (
    current.kind === "POWER_DURATION" &&
    (!input.resultWatts || !input.durationSeconds)
  )
    fail("持续输出测试需要实际时长（秒）与平均功率（W）");
  if (
    current.kind === "FIXED_ROUTE" &&
    (!input.routeName?.trim() || !input.durationSeconds || !input.distanceKm)
  )
    fail("固定路线测试需要路线名称、用时（秒）和距离（km）");
  if (current.kind !== "FIXED_ROUTE" && (input.routeName || input.distanceKm))
    fail("功率测试不接受路线结果，请检查测试类型");
  if (current.kind === "FTP" && input.durationSeconds)
    fail("请输入最终 FTP 结果；时长与平均功率请使用持续输出测试");
  if (current.kind === "FIXED_ROUTE" && input.resultWatts)
    fail("路线测试不接受 FTP 或平均功率结果");
}
