import { render, screen } from "@testing-library/react-native";
import type { WorkoutSegment } from "@ridepilot/contracts";
import { WorkoutProfileChart } from "../components/WorkoutProfileChart";
import {
  buildWorkoutProfile,
  comparisonMaximums,
} from "../model/workout-profile";

const segments: WorkoutSegment[] = [
  {
    type: "warmup",
    target: { kind: "duration", value: 10, unit: "min" },
    intensity: { kind: "power_watt", min: 80, max: 120 },
  },
  {
    type: "work",
    target: { kind: "duration", value: 45, unit: "min" },
    intensity: { kind: "power_watt", min: 180, max: 220 },
  },
  {
    type: "cooldown",
    target: { kind: "duration", value: 5, unit: "min" },
    intensity: { kind: "power_watt", min: 60, max: 100 },
  },
];
const distance: WorkoutSegment = {
  type: "work",
  target: { kind: "distance", value: 8, unit: "km" },
  intensity: { kind: "power_watt", min: 800, max: 1000 },
  repeatCount: 3,
};

test("time proportions, order and mean intensities match the training structure without changing ranges", () => {
  const original = JSON.stringify(segments);
  const profile = buildWorkoutProfile(segments)!;
  expect(profile.totalMinutes).toBe(60);
  expect(profile.blocks.map((block) => block.type)).toEqual([
    "warmup",
    "work",
    "cooldown",
  ]);
  expect(profile.blocks.map((block) => block.averageIntensity)).toEqual([
    100, 200, 80,
  ]);
  expect(profile.blocks[0].width).toBeCloseTo(1 / 6);
  expect(profile.blocks[1].width).toBeCloseTo(3 / 4);
  expect(profile.blocks[2].start).toBeCloseTo(55 / 60);
  expect(profile.blocks[2].width).toBeCloseTo(5 / 60);
  expect(JSON.stringify(segments)).toBe(original);
});

test("distance actions do not affect chart width, height, total time or legend", () => {
  expect(
    buildWorkoutProfile([segments[0], distance, segments[1], segments[2]]),
  ).toEqual(buildWorkoutProfile(segments));
});

test("repeats and fractional minutes contribute their actual total time", () => {
  const profile = buildWorkoutProfile([
    {
      ...segments[0],
      target: { kind: "duration", value: 2.5, unit: "min" },
      repeatCount: 4,
    },
    segments[2],
  ])!;
  expect(profile.totalMinutes).toBe(15);
  expect(profile.blocks[0].minutes).toBe(10);
  expect(profile.blocks[0].width).toBeCloseTo(2 / 3);
  expect(profile.legend[0]).toEqual({ type: "warmup", minutes: 10 });
});

test("mixed intensity units keep independent scales and share the same time positions", () => {
  const profile = buildWorkoutProfile([
    segments[0],
    { ...segments[1], intensity: { kind: "ftp_percent", min: 50, max: 70 } },
    segments[2],
  ])!;
  expect(profile.lanes).toEqual([
    { kind: "power_watt", unit: "W", maximum: 120 },
    { kind: "ftp_percent", unit: "%FTP", maximum: 80 },
  ]);
  expect(profile.blocks[1].averageIntensity).toBe(60);
  expect(profile.blocks[1].start).toBeCloseTo(10 / 60);
  expect(profile.blocks[1].width).toBeCloseTo(45 / 60);
});

test("renders an accessible chart and readable phase totals", async () => {
  await render(<WorkoutProfileChart segments={segments} />);
  expect(
    screen.getByRole("image", { name: /计划强度区间中值 200 W/ }),
  ).toBeTruthy();
  expect(screen.getByText("10 分钟 热身")).toBeTruthy();
  expect(screen.getByText("45 分钟 训练")).toBeTruthy();
  expect(screen.getByText("5 分钟 放松")).toBeTruthy();
});

test("mixed units render separate labelled lanes without dropping time actions", async () => {
  await render(
    <WorkoutProfileChart
      segments={[
        segments[0],
        {
          ...segments[1],
          intensity: { kind: "ftp_percent", min: 50, max: 70 },
        },
        segments[2],
      ]}
    />,
  );
  expect(screen.getAllByRole("image")).toHaveLength(2);
  expect(screen.getByText("计划区间中值 · W")).toBeTruthy();
  expect(screen.getByText("计划区间中值 · %FTP")).toBeTruthy();
  expect(
    screen.getByRole("image", {
      name: /训练结构（W）.*计划强度区间中值 60 %FTP/,
    }),
  ).toBeTruthy();
});

const hiddenChartCases: WorkoutSegment[][] = [
  [],
  [distance],
  [{ ...segments[0], target: { kind: "duration", value: 0, unit: "min" } }],
  [{ ...segments[0], intensity: { kind: "power_watt", min: 120, max: 80 } }],
  [{ ...segments[0], intensity: { kind: "power_watt", min: NaN, max: 80 } }],
];
test.each(hiddenChartCases.map((items) => ({ items })))(
  "empty, distance-only or invalid time data shows no chart: %#",
  async ({ items }) => {
    await render(<WorkoutProfileChart segments={items} />);
    expect(screen.queryByRole("image")).toBeNull();
    expect(screen.queryByText(/计划区间中值/)).toBeNull();
  },
);

test("before and after use one scale per unit, so a power increase remains visible", () => {
  const before = [segments[0]];
  const after = [
    segments[1],
    {
      ...segments[2],
      intensity: { kind: "ftp_percent" as const, min: 60, max: 80 },
    },
  ];
  const maximums = comparisonMaximums(before, after);
  expect(buildWorkoutProfile(before, maximums)!.lanes[0].maximum).toBe(240);
  expect(buildWorkoutProfile(after, maximums)!.lanes).toEqual([
    { kind: "power_watt", unit: "W", maximum: 240 },
    { kind: "ftp_percent", unit: "%FTP", maximum: 90 },
  ]);
});

test("mixed and distance-only courses explicitly disclose the omitted distance", async () => {
  const view = await render(
    <WorkoutProfileChart segments={[segments[0], distance]} />,
  );
  expect(view.getByText(/另含 24 公里距离动作/)).toBeTruthy();
  expect(view.getByText("10 分钟")).toBeTruthy();
  await view.rerender(<WorkoutProfileChart segments={[distance]} />);
  expect(view.queryByRole("image")).toBeNull();
  expect(view.getByText(/距离目标共 24 公里/)).toBeTruthy();
});
