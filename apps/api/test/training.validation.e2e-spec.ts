import { BadRequestException, ConflictException } from "@nestjs/common";
import { ManualWorkoutDraft } from "@ridepilot/contracts";
import {
  assertEditableDate,
  validateDraft,
} from "../src/modules/training/training.validation";

const draft = (
  overrides: Partial<ManualWorkoutDraft> = {},
): ManualWorkoutDraft => ({
  scheduledDate: "2099-01-01",
  title: null,
  purpose: null,
  segments: [
    {
      type: "work",
      target: { kind: "duration", value: 10, unit: "min" },
      intensity: { kind: "power_watt", min: 100, max: 150 },
    },
  ],
  ...overrides,
});

describe("training validation", () => {
  it("aggregates duration and distance independently", () => {
    expect(
      validateDraft(
        draft({
          segments: [
            {
              type: "warmup",
              target: { kind: "duration", value: 10, unit: "min" },
              intensity: { kind: "power_watt", min: 80, max: 100 },
              repeatCount: 2,
            },
            {
              type: "work",
              target: { kind: "distance", value: 20, unit: "km" },
              intensity: { kind: "power_watt", min: 150, max: 200 },
            },
          ],
        }),
        false,
      ),
    ).toEqual({ timeTargetMinutes: 20, distanceTargetKm: 20 });
  });
  it("rejects ftp percentages without ftp", () => {
    expect(() =>
      validateDraft(
        draft({
          segments: [
            {
              type: "work",
              target: { kind: "duration", value: 10, unit: "min" },
              intensity: { kind: "ftp_percent", min: 80, max: 90 },
            },
          ],
        }),
        false,
      ),
    ).toThrow(BadRequestException);
  });
  it("rejects empty courses", () => {
    expect(() => validateDraft(draft({ segments: [] }), true)).toThrow(
      BadRequestException,
    );
  });
  it("rejects historical dates", () => {
    expect(() => assertEditableDate("2000-01-01", "Asia/Shanghai")).toThrow(
      ConflictException,
    );
  });
});
