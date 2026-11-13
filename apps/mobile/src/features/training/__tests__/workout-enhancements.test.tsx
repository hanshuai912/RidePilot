import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { ManualWorkoutDraft } from "@ridepilot/contracts";
import { Editor } from "../components/Editor";
import { WorkoutDiff } from "../components/WorkoutDiff";
import { WorkoutAdjustmentFormHarness as WorkoutAdjustmentForm } from "./fixtures/WorkoutAdjustmentFormHarness";
import { TrainingCalendarGrid } from "../components/TrainingCalendarGrid";
import { calendarDays, moveCalendar } from "../model/calendar-period";

const draft: ManualWorkoutDraft = {
  scheduledDate: "2030-01-07",
  title: "骑行",
  purpose: "耐力",
  segments: [
    {
      type: "warmup",
      target: { kind: "duration", value: 5, unit: "min" },
      intensity: { kind: "ftp_percent", min: 50, max: 60 },
    },
    {
      type: "work",
      target: { kind: "duration", value: 10, unit: "min" },
      intensity: { kind: "power_watt", min: 100, max: 150 },
      repeatCount: 3,
    },
  ],
};
test("editor always exposes full parameters and sorting preserves units and repetitions", async () => {
  let latest = draft;
  const edit = jest.fn();
  function Harness() {
    const [value, set] = useState(draft);
    latest = value;
    return (
      <Editor
        draft={value}
        setDraft={set}
        hasFtp
        feedback={null}
        onAdd={jest.fn()}
        onEdit={edit}
        onDelete={jest.fn()}
        onSave={jest.fn()}
        onBack={jest.fn()}
      />
    );
  }
  await render(<Harness />);
  const sections = screen
    .getByTestId("workout-editor")
    .children.filter((child) => typeof child !== "string")
    .map((child) => child.props.testID)
    .filter(Boolean);
  expect(sections).toEqual([
    "workout-editor-information",
    "workout-editor-overview",
    "workout-editor-segments",
  ]);
  expect(screen.getByLabelText("课程名称")).toBeTruthy();
  expect(screen.getByLabelText("训练目的")).toBeTruthy();
  expect(screen.queryByText("简洁视图")).toBeNull();
  expect(screen.queryByText("专业视图")).toBeNull();
  expect(screen.queryByText("时长 +10%")).toBeNull();
  expect(screen.getByText("FTP 50–60%")).toBeTruthy();
  expect(screen.getByText("100–150 W")).toBeTruthy();
  expect(screen.getByText("时间 · 10 分钟 × 3")).toBeTruthy();
  expect(screen.queryByLabelText("上移第2个动作")).toBeNull();
  expect(screen.queryByLabelText("下移第1个动作")).toBeNull();
  expect(screen.getByLabelText("拖动第2个动作排序")).toBeTruthy();
  await fireEvent(screen.getByTestId("sortable-segments"), "dragEnd", {
    fromIndex: 1,
    toIndex: 0,
  });
  expect(latest.segments).toEqual([draft.segments[1], draft.segments[0]]);
  await fireEvent.press(screen.getByLabelText("编辑第1个动作"));
  expect(edit).toHaveBeenCalledWith(0);
  await fireEvent.changeText(screen.getByDisplayValue("骑行"), "专项训练");
  expect(latest.title).toBe("专项训练");
  expect(latest.segments).toEqual([draft.segments[1], draft.segments[0]]);
});
test("diff includes repeated duration, distance and both original and new intensities", async () => {
  await render(
    <WorkoutDiff
      before={draft}
      after={{
        ...draft,
        segments: [
          {
            ...draft.segments[0],
            target: { kind: "distance", value: 10, unit: "km" },
            repeatCount: 2,
            intensity: { kind: "ftp_percent", min: 40, max: 50 },
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("时间目标：35 → 0 分钟（-35）")).toBeTruthy();
  expect(screen.getByText("距离目标：0 → 20 公里")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "查看原课程动作" }));
  expect(screen.getByText("100–150 W")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "查看调整后动作" }));
  expect(screen.getByText("FTP 40–50%")).toBeTruthy();
});
test("future scope limits date selection and requires explicit range confirmation, while cancellation never generates", async () => {
  const submit = jest.fn();
  await render(
    <WorkoutAdjustmentForm
      scheduledDate={draft.scheduledDate}
      loading={false}
      error={null}
      onSubmit={submit}
      onChange={jest.fn()}
      onDirtyChange={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByText("联动后续课程"));
  await fireEvent.press(
    screen.getByRole("button", { name: "后续联动结束日期" }),
  );
  expect(screen.queryByRole("radio", { name: "2031年" })).toBeNull();
  expect(screen.queryByRole("radio", { name: "6日" })).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: "20日" }));
  await fireEvent.press(screen.getByRole("button", { name: "取消日期选择" }));
  expect(submit).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "后续联动结束日期" }).props
      .accessibilityValue.text,
  ).toBe("2030年1月13日");
  await fireEvent.press(
    screen.getByRole("button", { name: "后续联动结束日期" }),
  );
  await fireEvent.press(screen.getByRole("radio", { name: "20日" }));
  await fireEvent.press(screen.getByRole("button", { name: "确认日期" }));
  await fireEvent.press(screen.getByText("生成"));
  expect(submit).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "返回修改" }));
  expect(submit).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("生成"));
  await fireEvent.press(screen.getByText("确认范围并生成草稿"));
  expect(submit).toHaveBeenCalledWith("TIME_SHORT", "", "2030-01-20");
});
test("month calendar crosses years and clamps month navigation, showing rest for every date without scheduled training", async () => {
  expect(calendarDays("2030-01-15", "MONTH")).toHaveLength(42);
  expect(calendarDays("2030-01-15", "MONTH")[0]).toBe("2029-12-31");
  expect(moveCalendar("2030-01-31", "MONTH", 1)).toBe("2030-02-28");
  const select = jest.fn();
  await render(
    <TrainingCalendarGrid
      days={calendarDays("2030-01-15", "MONTH")}
      selectedDate="2030-01-15"
      view="MONTH"
      workouts={[]}
      events={[
        {
          id: "rest",
          date: "2030-01-07",
          kind: "REST",
          source: "AVAILABILITY",
          title: "休息",
        },
      ]}
      assessmentDates={["2030-01-10"]}
      raceDates={["2030-01-09"]}
      onSelect={select}
      onView={jest.fn()}
      onPrev={jest.fn()}
      onNext={jest.fn()}
    />,
  );
  expect(screen.getByLabelText("2030-01-07，休息")).toBeTruthy();
  expect(screen.getByLabelText("2030-01-09，有比赛")).toBeTruthy();
  expect(screen.getByLabelText("2030-01-10，有阶段测试")).toBeTruthy();
  expect(screen.queryByLabelText("2030-01-09，有比赛，休息")).toBeNull();
  await fireEvent.press(screen.getByLabelText("2030-01-08，休息"));
  expect(select).toHaveBeenCalledWith("2030-01-08");
});
