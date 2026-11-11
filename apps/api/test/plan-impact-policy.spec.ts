import { changedInputs } from "../src/modules/coach/plan-impact/plan-impact.policy";
import type { TrainingInputSnapshot } from "../src/modules/training/training-input-snapshot";

const snapshot = (weightKg: number): TrainingInputSnapshot => ({
  ftp: { id: "ftp-1", valueWatts: 220 },
  availability: { version: 1, timezone: "Asia/Shanghai" },
  goals: [{ id: "goal-1", version: 1, status: "ACTIVE", priority: "PRIMARY" }],
  profile: {
    version: 2,
    heightCm: 175,
    weightKg,
    experienceLevel: "INTERMEDIATE",
    heartRateVersion: 1,
  },
});

describe("plan impact input policy", () => {
  it("detects a changed body condition in new plan snapshots", () => {
    expect(changedInputs(snapshot(70), snapshot(74), [])).toEqual(["PROFILE"]);
  });

  it("keeps legacy plans without profile snapshots compatible", () => {
    const legacy = snapshot(70);
    delete legacy.profile;
    expect(changedInputs(legacy, snapshot(74), [])).toEqual([]);
  });
});
