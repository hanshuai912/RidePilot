import { z } from "zod";
import type { Assessment, AssessmentPatch } from "@ridepilot/contracts";

export const resultStatuses = {
  COMPLETED: "已完成",
  INCOMPLETE: "未完成",
  POSTPONED: "改期",
  SKIPPED: "跳过",
  INVALID: "无效",
} as const;
const base = z.object({
  status: z.enum([
    "COMPLETED",
    "INCOMPLETE",
    "POSTPONED",
    "SKIPPED",
    "INVALID",
  ]),
  protocol: z.string().max(64),
  actualDate: z.string(),
  localDate: z.string(),
  resultWatts: z.string(),
  durationSeconds: z.string(),
  routeName: z.string().max(120),
  distanceKm: z.string(),
  source: z.enum(["", "TRAINER", "POWER_METER", "DEVICE_REPORT", "MANUAL"]),
  rpe: z.string(),
  conditions: z.string().max(200),
  notes: z.string().max(500),
  reason: z.string().max(200),
  comparableConditions: z.boolean(),
});
export type ResultForm = z.infer<typeof base>;
export function resultFormSchema(kind: Assessment["kind"], today: string) {
  return base.superRefine((value, context) => {
    const issue = (path: keyof ResultForm, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (value.status !== "COMPLETED" && !value.reason.trim())
      issue("reason", "请填写原因");
    if (
      value.status === "POSTPONED" &&
      (!z.iso.date().safeParse(value.localDate).success ||
        value.localDate < today)
    )
      issue("localDate", "请选择今天或未来的改期日期");
    if (
      ["COMPLETED", "INCOMPLETE"].includes(value.status) &&
      (!z.iso.date().safeParse(value.actualDate).success ||
        value.actualDate > today)
    )
      issue("actualDate", "实际日期须为今天或过去，格式 YYYY-MM-DD");
    if (value.status !== "COMPLETED") return;
    if (!value.protocol.trim()) issue("protocol", "请填写测试方法");
    if (!value.source) issue("source", "请选择结果来源");
    const integer = (
      name: "rpe" | "resultWatts" | "durationSeconds",
      min: number,
      max: number,
      message: string,
    ) => {
      const num = Number(value[name]);
      if (
        !value[name].trim() ||
        !Number.isInteger(num) ||
        num < min ||
        num > max
      )
        issue(name, message);
    };
    integer("rpe", 1, 10, "RPE 需为 1–10 的整数");
    if (kind === "FTP")
      integer("resultWatts", 50, 800, "最终 FTP 需为 50–800 W");
    if (kind === "POWER_DURATION")
      integer("resultWatts", 1, 2500, "平均功率需为 1–2500 W");
    if (kind !== "FTP")
      integer("durationSeconds", 1, 86400, "实际用时需为 1–86400 秒");
    if (kind === "FIXED_ROUTE") {
      if (!value.routeName.trim()) issue("routeName", "请填写固定路线名称");
      if (!(Number(value.distanceKm) > 0 && Number(value.distanceKm) <= 2000))
        issue("distanceKm", "路线距离需大于 0 且不超过 2000 km");
    }
  });
}

export function resultPayload(
  item: Assessment,
  form: ResultForm,
): AssessmentPatch {
  if (form.status === "POSTPONED")
    return {
      expectedVersion: item.version,
      status: form.status,
      localDate: form.localDate,
      reason: form.reason,
    };
  if (form.status !== "COMPLETED")
    return {
      expectedVersion: item.version,
      status: form.status,
      reason: form.reason,
      ...(form.status === "INCOMPLETE"
        ? {
            actualDate: form.actualDate,
            notes: form.notes,
            conditions: form.conditions,
          }
        : {}),
    };
  return {
    expectedVersion: item.version,
    status: form.status,
    actualDate: form.actualDate,
    protocol: form.protocol,
    source: form.source || undefined,
    rpe: Number(form.rpe),
    notes: form.notes,
    conditions: form.conditions,
    comparableConditions: form.comparableConditions,
    ...(item.kind === "FTP"
      ? { resultWatts: Number(form.resultWatts) }
      : item.kind === "POWER_DURATION"
        ? {
            resultWatts: Number(form.resultWatts),
            durationSeconds: Number(form.durationSeconds),
          }
        : {
            routeName: form.routeName,
            distanceKm: Number(form.distanceKm),
            durationSeconds: Number(form.durationSeconds),
          }),
  };
}
