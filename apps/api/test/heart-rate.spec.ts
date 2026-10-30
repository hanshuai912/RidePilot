import {
  calculateHeartRateZones,
  heartRateSaveSchema,
  heartRateSettingsSchema,
  type HeartRateValues,
} from "@ridepilot/contracts";
const values: HeartRateValues = {
  method: "MAX",
  maxHeartRate: 200,
  restingHeartRate: 60,
  lactateThresholdHeartRate: 180,
};

describe("heart rate zone rules", () => {
  it("uses max heart rate for five contiguous zones", () => {
    expect(
      calculateHeartRateZones(values).map(({ minBpm, maxBpm }) => [
        minBpm,
        maxBpm,
      ]),
    ).toEqual([
      [100, 119],
      [120, 139],
      [140, 159],
      [160, 179],
      [180, 200],
    ]);
  });
  it("adds resting heart rate to reserve percentages", () => {
    expect(
      calculateHeartRateZones({ ...values, method: "RESERVE" }).map(
        ({ minBpm, maxBpm }) => [minBpm, maxBpm],
      ),
    ).toEqual([
      [130, 143],
      [144, 157],
      [158, 171],
      [172, 185],
      [186, 200],
    ]);
  });
  it("uses seven threshold zones with an open upper end", () => {
    expect(
      calculateHeartRateZones({ ...values, method: "LTHR" }).map(
        ({ minBpm, maxBpm }) => [minBpm, maxBpm],
      ),
    ).toEqual([
      [0, 152],
      [153, 161],
      [162, 170],
      [171, 179],
      [180, 185],
      [186, 192],
      [193, null],
    ]);
  });
  it("has no gaps, overlaps, or reversed integer intervals across accepted inputs", () => {
    for (let base = 80; base <= 250; base++) {
      for (const method of ["MAX", "RESERVE", "LTHR"] as const) {
        const zones = calculateHeartRateZones({
          ...values,
          method,
          maxHeartRate: base,
          restingHeartRate: base - 60,
          lactateThresholdHeartRate: base,
        });
        // Reserve inputs outside the field bounds deliberately return placeholders.
        if (zones[0]!.minBpm === null) continue;
        for (let i = 0; i < zones.length; i++) {
          const current = zones[i]!;
          if (current.maxBpm !== null)
            expect(current.minBpm!).toBeLessThanOrEqual(current.maxBpm);
          if (i > 0) expect(current.minBpm).toBe(zones[i - 1]!.maxBpm! + 1);
        }
      }
    }
  });
  it("requires the selected fields and preserves inactive values without using them", () => {
    expect(
      heartRateSettingsSchema.safeParse({ ...values, maxHeartRate: null })
        .success,
    ).toBe(false);
    expect(
      calculateHeartRateZones({
        ...values,
        method: "LTHR",
        maxHeartRate: null,
        restingHeartRate: null,
      }),
    ).toEqual(calculateHeartRateZones({ ...values, method: "LTHR" }));
    expect(
      calculateHeartRateZones({ ...values, maxHeartRate: null }).every(
        (zone) => zone.minBpm === null,
      ),
    ).toBe(true);
  });
  it.each([
    { maxHeartRate: 251 },
    { restingHeartRate: 121 },
    { lactateThresholdHeartRate: 79 },
    { maxHeartRate: 200.5 },
    { maxHeartRate: 100, restingHeartRate: 100 },
    { method: "RESERVE", maxHeartRate: 100, restingHeartRate: 95 },
    { method: "LTHR", lactateThresholdHeartRate: null },
    { userId: "another-user" },
    { expectedVersion: -1 },
  ])("rejects invalid or ownership-changing settings %j", (patch) => {
    expect(
      heartRateSaveSchema.safeParse({ ...values, expectedVersion: 0, ...patch })
        .success,
    ).toBe(false);
  });
});
