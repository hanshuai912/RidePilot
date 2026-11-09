import {
  scheduleConflicts,
  assertReschedule,
  type ScheduleContext,
} from "../src/modules/training/workout-schedule";
import { calendarEvents } from "../src/modules/training/calendar-events";
import type {
  ManualWorkoutDraft,
  CalendarResponse,
} from "@ridepilot/contracts";
import type { Prisma } from "../src/generated/prisma/client";

const draft: ManualWorkoutDraft = {
  scheduledDate: "2030-01-07",
  segments: [
    {
      type: "work",
      target: { kind: "duration", value: 20, unit: "min" },
      repeatCount: 2,
      intensity: { kind: "ftp_percent", min: 60, max: 70 },
    },
  ],
};
const context: ScheduleContext = {
  slots: [{ weekday: 1, availableMinutes: 90 }],
  maxSessionMinutes: 60,
  races: [],
  assessments: [],
  workouts: [],
};
test("multiple courses may share a date within the daily budget, including repeat durations", () => {
  expect(
    scheduleConflicts(
      {
        ...context,
        workouts: [{ date: draft.scheduledDate, minutes: 40, distance: false }],
      },
      draft,
    ),
  ).toEqual([]);
  expect(
    scheduleConflicts(
      {
        ...context,
        workouts: [{ date: draft.scheduledDate, minutes: 60, distance: false }],
      },
      draft,
    ),
  ).toContain("目标日期的课程总时长超过当日可用时间");
});
test("conflicts expose races, postponed tests, rest days, missing availability and session limits", () => {
  expect(
    scheduleConflicts(
      {
        ...context,
        races: [draft.scheduledDate],
        assessments: [draft.scheduledDate],
        slots: [],
        maxSessionMinutes: 30,
      },
      draft,
    ),
  ).toHaveLength(4);
  expect(
    scheduleConflicts({ ...context, slots: null }, draft).join(),
  ).toContain("先设置可训练时间");
});
test("distance targets and other distance courses are never assigned a fabricated duration", () => {
  expect(
    scheduleConflicts(context, {
      ...draft,
      segments: [
        {
          ...draft.segments[0],
          target: { kind: "distance", value: 10, unit: "km" },
        },
      ],
    }).join(),
  ).toContain("无法可靠换算时长");
  expect(
    scheduleConflicts(
      {
        ...context,
        workouts: [
          { date: draft.scheduledDate, minutes: null, distance: true },
        ],
      },
      draft,
    ).join(),
  ).toContain("无法可靠换算时长");
});
test("rest is derived only from supplied time settings; missing data is unknown and a scheduled course takes precedence", () => {
  expect(calendarEvents("2030-01-07", "2030-01-08", null, [])).toEqual([]);
  expect(
    calendarEvents("2030-01-07", "2030-01-08", [{ weekday: 1 }], []),
  ).toEqual([
    {
      id: "rest-2030-01-08",
      date: "2030-01-08",
      kind: "REST",
      source: "AVAILABILITY",
      title: "固定休息日 · 可训练时间设置",
    },
  ]);
  expect(
    calendarEvents("2030-01-07", "2030-01-07", [], [
      { scheduledDate: "2030-01-07", segments: draft.segments },
    ] as CalendarResponse["items"]),
  ).toEqual([]);
});
test("recovery events require an actual recovery structure, not an empty date or a warmup", () => {
  const workout = {
    id: "workout",
    scheduledDate: "2030-01-07",
    title: "恢复骑",
    segments: [{ ...draft.segments[0], type: "recovery" }],
  } as CalendarResponse["items"][number];
  expect(
    calendarEvents("2030-01-07", "2030-01-07", null, [workout])[0].kind,
  ).toBe("RECOVERY");
  expect(
    calendarEvents("2030-01-07", "2030-01-07", null, [
      { ...workout, segments: draft.segments },
    ]),
  ).toEqual([]);
});
test("publication rechecks late schedule conflicts with the transaction client and excludes only the moved workout", async () => {
  const tx = {
    trainingAvailability: {
      findUnique: jest.fn().mockResolvedValue({
        timezone: "UTC",
        version: 1,
        weekdays: context.slots,
        maxSessionMinutes: 60,
      }),
    },
    trainingRace: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ localDate: new Date("2030-01-07T00:00:00Z") }]),
    },
    trainingAssessment: { findMany: jest.fn().mockResolvedValue([]) },
    trainingPlan: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  await expect(
    assertReschedule(
      tx as unknown as Prisma.TransactionClient,
      "owner",
      draft,
      { id: "moved", scheduledDate: "2030-01-06" },
      "UTC",
    ),
  ).rejects.toMatchObject({ response: { code: "WORKOUT_SCHEDULE_CONFLICT" } });
  expect(tx.trainingRace.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ userId: "owner", status: "CONFIRMED" }),
    }),
  );
  expect(tx.trainingAssessment.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        status: { in: ["SCHEDULED", "POSTPONED"] },
      }),
    }),
  );
  expect(tx.trainingPlan.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: "owner", status: "ACTIVE" } }),
  );
});
