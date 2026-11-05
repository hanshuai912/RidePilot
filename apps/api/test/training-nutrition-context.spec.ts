import { trainingDateSignatures } from "../src/modules/nutrition/training-nutrition-context";

const workout = {
  scheduledDate: new Date("2030-01-01T00:00:00Z"),
  title: "长骑",
  purpose: "耐力",
  timeTargetMin: 180,
  distanceTargetKm: null,
  structure: { steps: [{ durationSec: 10800, intensity: "Z2" }] },
};
it("detects removed workouts, while rest days and equivalent JSON remain stable", () => {
  const original = trainingDateSignatures("2030-01-01", "2030-01-02", [
    workout,
  ]);
  const rest = trainingDateSignatures("2030-01-01", "2030-01-02", []);
  expect(original["2030-01-01"]).not.toBe(rest["2030-01-01"]);
  expect(original["2030-01-02"]).toBe(rest["2030-01-02"]);
  expect(
    trainingDateSignatures("2030-01-01", "2030-01-02", [
      {
        ...workout,
        structure: { steps: [{ intensity: "Z2", durationSec: 10800 }] },
      },
    ]),
  ).toEqual(original);
});
it("detects duration and intensity changes even when the date stays the same", () => {
  const signature = trainingDateSignatures("2030-01-01", "2030-01-01", [
    workout,
  ]);
  expect(
    trainingDateSignatures("2030-01-01", "2030-01-01", [
      { ...workout, timeTargetMin: 60 },
    ]),
  ).not.toEqual(signature);
  expect(
    trainingDateSignatures("2030-01-01", "2030-01-01", [
      {
        ...workout,
        structure: { steps: [{ intensity: "Z4", durationSec: 10800 }] },
      },
    ]),
  ).not.toEqual(signature);
});

it("ignores the stable activity identity added when an unchanged workout is copied", () => {
  const original = trainingDateSignatures("2030-01-01", "2030-01-01", [
    workout,
  ]);
  const copied = trainingDateSignatures("2030-01-01", "2030-01-01", [
    {
      ...workout,
      structure: { ...workout.structure, activityWorkoutId: "historical-id" },
    },
  ]);
  expect(copied).toEqual(original);
});
