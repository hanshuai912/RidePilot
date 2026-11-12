import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react-native";
import type { Workout } from "../model/training";
import { ScheduledWorkoutCard } from "../components/ScheduledWorkoutCard";

const item: Workout = {
  id: "00000000-0000-4000-8000-000000000001",
  planVersion: 1,
  sportType: "cycling",
  source: "manual",
  title: "耐力骑行",
  purpose: null,
  scheduledDate: "2030-01-08",
  dayOrder: 1,
  timeTargetMinutes: null,
  distanceTargetKm: 8,
  segments: [],
};
const actions = {
  onDetail: jest.fn(),
  onAdjust: jest.fn(),
  onEdit: jest.fn(),
};
beforeEach(() => jest.clearAllMocks());

test("opens details from the card and keeps only two independent action buttons", async () => {
  await render(
    <ScheduledWorkoutCard item={item} today="2030-01-08" {...actions} />,
  );
  const primary = within(
    screen.getByTestId(`workout-primary-actions-${item.id}`),
  );
  expect(primary.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByText("查看课程")).toBeNull();
  expect(screen.queryByRole("button", { name: "课程改期" })).toBeNull();
  await fireEvent.press(primary.getByRole("button", { name: "调整今天" }));
  await fireEvent.press(primary.getByRole("button", { name: "编辑动作" }));
  expect(actions.onDetail).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "查看耐力骑行详情" }),
  );
  for (const handler of Object.values(actions))
    expect(handler).toHaveBeenCalledTimes(1);
});

test.each([
  { name: "past", workout: item, today: "2030-01-09" },
  {
    name: "locked",
    workout: { ...item, editable: false },
    today: "2030-01-08",
  },
  {
    name: "recorded",
    workout: {
      ...item,
      activity: {
        id: item.id,
        status: "COMPLETED" as const,
        durationMin: 30,
        rpe: null,
        fatigue: null,
        notes: null,
      },
    },
    today: "2030-01-08",
  },
])(
  "$name courses keep viewing available and hide unavailable editing tools",
  async ({ workout, today }) => {
    await render(
      <ScheduledWorkoutCard item={workout} today={today} {...actions} />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByTestId(`workout-primary-actions-${item.id}`),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "查看耐力骑行详情" }),
    );
    expect(actions.onDetail).toHaveBeenCalledTimes(1);
    expect(actions.onAdjust).not.toHaveBeenCalled();
    expect(actions.onEdit).not.toHaveBeenCalled();
  },
);
