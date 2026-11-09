import { useState } from "react";
import {
  render,
  renderHook,
  screen,
  fireEvent,
} from "@testing-library/react-native";
import type { ManualWorkoutDraft, WorkoutSegment } from "@ridepilot/contracts";
import { Editor } from "../components/Editor";
import {
  WorkoutSegmentList,
  segmentTotals,
} from "../components/WorkoutSegmentList";
import { useSortableSegments } from "../hooks/useSortableSegments";

const draft: ManualWorkoutDraft = {
  scheduledDate: "2030-01-07",
  title: "专项",
  segments: [
    {
      type: "warmup",
      target: { kind: "duration", value: 5, unit: "min" },
      intensity: { kind: "ftp_percent", min: 50, max: 60 },
    },
    {
      type: "work",
      target: { kind: "duration", value: 10, unit: "min" },
      intensity: { kind: "power_watt", min: 140, max: 180 },
      repeatCount: 3,
    },
    {
      type: "cooldown",
      target: { kind: "distance", value: 2, unit: "km" },
      intensity: { kind: "ftp_percent", min: 40, max: 50 },
    },
  ],
};

test("dropping across multiple rows updates the draft and subsequent editing and saving use the new order", async () => {
  let latest = draft;
  const save = jest.fn();
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
        onBack={jest.fn()}
        onDelete={jest.fn()}
        onEdit={edit}
        onSave={() => save(value)}
      />
    );
  }
  await render(<Harness />);
  const grid = screen.getByTestId("sortable-segments");
  expect(grid.props.customHandle).toBe(true);
  expect(grid.props.sortEnabled).toBe(true);
  await fireEvent(grid, "dragEnd", { fromIndex: 2, toIndex: 0 });
  expect(latest.segments).toEqual([
    draft.segments[2],
    draft.segments[0],
    draft.segments[1],
  ]);
  expect(segmentTotals(latest.segments)).toEqual({
    minutes: 35,
    kilometers: 2,
  });
  expect(screen.getByText("1 · 放松")).toBeTruthy();
  expect(edit).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("1 · 放松"));
  expect(edit).toHaveBeenLastCalledWith(0);
  await fireEvent.press(screen.getByText("保存当天课程"));
  expect(save).toHaveBeenCalledWith(latest);
  expect(draft.segments[0].type).toBe("warmup");
});

test("a drop at the same position or outside the list does not mark the draft dirty", async () => {
  const move = jest.fn();
  await render(<WorkoutSegmentList segments={draft.segments} onMove={move} />);
  for (const [fromIndex, toIndex] of [
    [1, 1],
    [-1, 0],
    [1, 3],
    [1, 0.5],
  ]) {
    await fireEvent(screen.getByTestId("sortable-segments"), "dragEnd", {
      fromIndex,
      toIndex,
    });
  }
  expect(move).not.toHaveBeenCalled();
});

test("read only and saving states expose no drag handle; a single action cannot be dragged", async () => {
  const view = await render(<WorkoutSegmentList segments={draft.segments} />);
  expect(screen.queryByTestId("sortable-segments")).toBeNull();
  expect(screen.queryByLabelText("拖动第1个动作排序")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("140–180 W")).toBeTruthy();
  await view.rerender(
    <WorkoutSegmentList segments={[draft.segments[0]]} onMove={jest.fn()} />,
  );
  expect(screen.getByTestId("sortable-segments").props.sortEnabled).toBe(false);
  expect(screen.queryByLabelText("拖动第1个动作排序")).toBeNull();
  await view.rerender(
    <Editor
      draft={draft}
      setDraft={jest.fn()}
      hasFtp
      feedback={null}
      busy
      onAdd={jest.fn()}
      onBack={jest.fn()}
      onDelete={jest.fn()}
      onEdit={jest.fn()}
      onSave={jest.fn()}
    />,
  );
  expect(screen.queryByTestId("sortable-segments")).toBeNull();
  expect(screen.queryByLabelText("编辑第1个动作")).toBeNull();
  expect(screen.queryByLabelText("删除第1个动作")).toBeNull();
});

test("the action body opens editing while the separate delete button and drag handle never do", async () => {
  const edit = jest.fn();
  const remove = jest.fn();
  const move = jest.fn();
  await render(
    <WorkoutSegmentList
      segments={draft.segments}
      onEdit={edit}
      onDelete={remove}
      onMove={move}
    />,
  );
  await fireEvent.press(screen.getByText("2 · 训练"));
  await fireEvent.press(screen.getByText("时间 · 10 分钟 × 3"));
  await fireEvent.press(screen.getByText("140–180 W"));
  expect(edit.mock.calls).toEqual([[1], [1], [1]]);
  edit.mockClear();

  await fireEvent.press(screen.getByRole("button", { name: "删除第2个动作" }));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith(1);
  await fireEvent.press(screen.getByLabelText("拖动第2个动作排序"));
  await fireEvent(screen.getByTestId("sortable-segments"), "dragEnd", {
    fromIndex: 1,
    toIndex: 0,
  });
  expect(move).toHaveBeenCalledWith(1, 0);
  expect(edit).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledTimes(1);
});

test("screen reader actions reorder through the handle without visible arrow buttons", async () => {
  const move = jest.fn();
  await render(<WorkoutSegmentList segments={draft.segments} onMove={move} />);
  await fireEvent(
    screen.getByLabelText("拖动第2个动作排序"),
    "accessibilityAction",
    { nativeEvent: { actionName: "decrement" } },
  );
  expect(move).toHaveBeenCalledWith(1, 0);
  expect(screen.queryByLabelText("上移第2个动作")).toBeNull();
  expect(
    screen.getByLabelText("拖动第1个动作排序").props.accessibilityActions,
  ).toEqual([{ name: "increment", label: "移至后一位" }]);
});

test("unsaved identical actions get distinct stable keys without introducing persisted IDs", async () => {
  const first = { ...draft.segments[0] };
  const second = { ...draft.segments[0] };
  const hook = await renderHook(
    ({ segments }: { segments: WorkoutSegment[] }) =>
      useSortableSegments(segments),
    { initialProps: { segments: [first, second, first] } },
  );
  const keys = hook.result.current.map((row) => row.key);
  expect(new Set(keys).size).toBe(3);
  await hook.rerender({ segments: [second, first, first] });
  expect(hook.result.current.map((row) => row.key)).toEqual([
    keys[1],
    keys[0],
    keys[2],
  ]);
  expect(first).not.toHaveProperty("id");
  expect(second).not.toHaveProperty("id");
});
