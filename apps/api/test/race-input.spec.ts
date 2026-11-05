import {
  raceInputSchema,
  raceResponseSchema,
  raceResultInputSchema,
} from "@ridepilot/contracts";

describe("race contracts", () => {
  it("accepts a structured race and preserves optional planning context", () => {
    const race = raceInputSchema.parse({
      name: "环湖公路赛",
      localDate: "2030-06-09",
      timezone: "Asia/Shanghai",
      distanceKm: 120,
      type: "GRAN_FONDO",
      elevationGainM: 1800,
      priority: "A",
      intent: "PERFORMANCE",
    });
    expect(race.type).toBe("GRAN_FONDO");
    expect(race.elevationGainM).toBe(1800);
    expect(race.intent).toBe("PERFORMANCE");
  });

  it("rejects an invalid timezone-independent result payload", () => {
    expect(() =>
      raceResultInputSchema.parse({
        status: "COMPLETED",
        actualDate: "2030-06-09",
        rpe: 11,
      }),
    ).toThrow();
  });

  it("requires server-owned race fields in responses", () => {
    expect(() =>
      raceResponseSchema.parse({
        name: "赛事",
        localDate: "2030-06-09",
        timezone: "Asia/Shanghai",
        distanceKm: 100,
        priority: "A",
        status: "CONFIRMED",
        version: 1,
      }),
    ).toThrow();
  });
});
