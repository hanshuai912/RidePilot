import { z } from "zod";

export const heartRateMethodSchema = z.enum(["MAX", "RESERVE", "LTHR"]);
export const HEART_RATE_RULE_VERSION = 1;
export const heartRateInputBounds = {
  maxHeartRate: { min: 80, max: 250 },
  restingHeartRate: { min: 20, max: 120 },
  lactateThresholdHeartRate: { min: 80, max: 250 },
} as const;
const bpm = (bounds: { min: number; max: number }) =>
  z.number().int().min(bounds.min).max(bounds.max).nullable();
export const heartRateValuesSchema = z
  .object({
    method: heartRateMethodSchema,
    maxHeartRate: bpm(heartRateInputBounds.maxHeartRate),
    restingHeartRate: bpm(heartRateInputBounds.restingHeartRate),
    lactateThresholdHeartRate: bpm(
      heartRateInputBounds.lactateThresholdHeartRate,
    ),
  })
  .strict();

export const heartRateSettingsSchema = heartRateValuesSchema.superRefine(
  (value, ctx) => {
    const required =
      value.method === "LTHR"
        ? (["lactateThresholdHeartRate"] as const)
        : value.method === "RESERVE"
          ? (["maxHeartRate", "restingHeartRate"] as const)
          : (["maxHeartRate"] as const);
    for (const field of required) {
      if (value[field] === null)
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "请填写所选类型需要的心率",
        });
    }
    if (
      value.maxHeartRate !== null &&
      value.restingHeartRate !== null &&
      value.restingHeartRate >= value.maxHeartRate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["restingHeartRate"],
        message: "静息心率必须小于最大心率",
      });
    }
    if (
      value.method === "RESERVE" &&
      value.maxHeartRate !== null &&
      value.restingHeartRate !== null &&
      value.maxHeartRate - value.restingHeartRate < 10 &&
      value.restingHeartRate < value.maxHeartRate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["restingHeartRate"],
        message: "最大心率与静息心率需至少相差 10 bpm，才能划分五个整数区间",
      });
    }
  },
);
export const heartRateSaveSchema = heartRateSettingsSchema.safeExtend({
  expectedVersion: z.number().int().nonnegative(),
});
export const heartRateResponseSchema = heartRateSettingsSchema.safeExtend({
  ruleVersion: z.literal(HEART_RATE_RULE_VERSION),
  version: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
});
export const heartRateReadSchema = z.object({
  settings: heartRateResponseSchema.nullable(),
});
export type HeartRateMethod = z.infer<typeof heartRateMethodSchema>;
export type HeartRateValues = z.infer<typeof heartRateValuesSchema>;
export type HeartRateSave = z.infer<typeof heartRateSaveSchema>;
export type HeartRateResponse = z.infer<typeof heartRateResponseSchema>;

export const heartRateMethodLabels: Record<HeartRateMethod, string> = {
  MAX: "最大心率区间",
  RESERVE: "储备心率区间",
  LTHR: "乳酸阈心率区间",
};
export type HeartRateZone = {
  id: string;
  name: string;
  percentage: string;
  minBpm: number | null;
  maxBpm: number | null;
};

// Integer lower bounds are inclusive; the next lower bound minus one ends a zone.
// V1 product defaults: linear 50–100% for MAX/RESERVE, threshold seven zones.
export function calculateHeartRateZones(
  values: HeartRateValues,
): HeartRateZone[] {
  const threshold = values.method === "LTHR";
  const names = threshold
    ? ["恢复", "有氧耐力", "节奏", "阈值", "超阈值", "高强度", "极高强度"]
    : ["恢复", "有氧耐力", "节奏", "阈值", "高强度"];
  const percentages = threshold
    ? [
        "<85%",
        "85–<90%",
        "90–<95%",
        "95–<100%",
        "100–<103%",
        "103–<107%",
        "≥107%",
      ]
    : ["50–<60%", "60–<70%", "70–<80%", "80–<90%", "90–100%"];
  // Inactive values are retained but must not affect the active calculation.
  const relevant = {
    method: values.method,
    maxHeartRate: threshold ? null : values.maxHeartRate,
    restingHeartRate:
      values.method === "RESERVE" ? values.restingHeartRate : null,
    lactateThresholdHeartRate: threshold
      ? values.lactateThresholdHeartRate
      : null,
  };
  const valid = heartRateSettingsSchema.safeParse(relevant).success;
  const base = threshold
    ? values.lactateThresholdHeartRate
    : values.maxHeartRate;
  const rest = values.method === "RESERVE" ? (values.restingHeartRate ?? 0) : 0;
  const lowerPercentages = threshold
    ? [0, 85, 90, 95, 100, 103, 107]
    : [50, 60, 70, 80, 90];
  const boundary = (percent: number) =>
    Math.ceil((rest * 100 + ((base ?? 0) - rest) * percent) / 100);
  return names.map((name, index) => ({
    id: `Z${index + 1}`,
    name,
    percentage: percentages[index]!,
    minBpm: valid
      ? threshold && index === 0
        ? 0
        : boundary(lowerPercentages[index]!)
      : null,
    maxBpm: !valid
      ? null
      : index < names.length - 1
        ? boundary(lowerPercentages[index + 1]!) - 1
        : threshold
          ? null
          : base,
  }));
}
