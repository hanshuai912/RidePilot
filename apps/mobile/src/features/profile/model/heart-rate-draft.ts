import {
  heartRateInputBounds,
  heartRateSettingsSchema,
  type HeartRateMethod,
  type HeartRateValues,
} from "@ridepilot/contracts";

export type HeartRateDraft = {
  method: HeartRateMethod;
  maxHeartRate: string;
  restingHeartRate: string;
  lactateThresholdHeartRate: string;
};
export const heartRateFieldLabels = {
  maxHeartRate: "最大心率",
  restingHeartRate: "静息心率",
  lactateThresholdHeartRate: "乳酸阈心率",
};
export type HeartRateField = keyof typeof heartRateFieldLabels;
export function toHeartRateDraft(
  values?: HeartRateValues | null,
): HeartRateDraft {
  return {
    method: values?.method ?? "MAX",
    maxHeartRate: values?.maxHeartRate?.toString() ?? "",
    restingHeartRate: values?.restingHeartRate?.toString() ?? "",
    lactateThresholdHeartRate:
      values?.lactateThresholdHeartRate?.toString() ?? "",
  };
}
export function parseHeartRateDraft(draft: HeartRateDraft) {
  const number = (value: string) =>
    value.trim() === ""
      ? null
      : /^\d+$/.test(value.trim())
        ? Number(value)
        : NaN;
  const values: HeartRateValues = {
    method: draft.method,
    maxHeartRate: number(draft.maxHeartRate),
    restingHeartRate: number(draft.restingHeartRate),
    lactateThresholdHeartRate: number(draft.lactateThresholdHeartRate),
  };
  const parsed = heartRateSettingsSchema.safeParse(values);
  const errors: string[] = [];
  for (const field of Object.keys(heartRateFieldLabels) as HeartRateField[]) {
    const value = values[field];
    const { min, max } = heartRateInputBounds[field];
    if (
      value !== null &&
      (!Number.isInteger(value) || value < min || value > max)
    )
      errors.push(
        `${heartRateFieldLabels[field]}请输入 ${min}–${max} bpm 之间的整数`,
      );
  }
  if (
    values.restingHeartRate !== null &&
    values.maxHeartRate !== null &&
    values.restingHeartRate >= values.maxHeartRate
  )
    errors.push("静息心率必须小于最大心率");
  if (
    draft.method === "RESERVE" &&
    values.restingHeartRate !== null &&
    values.maxHeartRate !== null &&
    values.maxHeartRate > values.restingHeartRate &&
    values.maxHeartRate - values.restingHeartRate < 10
  )
    errors.push("最大心率与静息心率需至少相差 10 bpm，才能划分五个整数区间");
  return { values, valid: parsed.success, errors };
}
