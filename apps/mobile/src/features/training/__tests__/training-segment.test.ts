import { segmentTotals } from "../components/WorkoutSegmentList";

describe("manual training segment totals", () => {
  it("keeps duration and distance totals separate and applies repeats", () => {
    expect(
      segmentTotals([
        {
          type: "warmup",
          target: { kind: "duration", value: 5, unit: "min" },
          intensity: { kind: "power_watt", min: 80, max: 100 },
          repeatCount: 2,
        },
        {
          type: "work",
          target: { kind: "distance", value: 8, unit: "km" },
          intensity: { kind: "ftp_percent", min: 80, max: 90 },
        },
      ]),
    ).toEqual({ minutes: 10, kilometers: 8 });
  });
});
