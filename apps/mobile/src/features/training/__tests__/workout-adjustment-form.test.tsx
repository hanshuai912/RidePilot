import { fireEvent, render } from "@testing-library/react-native";
import { WorkoutAdjustmentFormHarness as WorkoutAdjustmentForm } from "./fixtures/WorkoutAdjustmentFormHarness";

function formProps() {
  return {
    scheduledDate: "2030-01-07",
    loading: false,
    error: null as string | null,
    onSubmit: jest.fn(),
    onDirtyChange: jest.fn(),
    onChange: jest.fn(),
  };
}

it("keeps notes and the main reason when changing scope, and submits only the selected scope", async () => {
  const props = formProps();
  const ui = await render(<WorkoutAdjustmentForm {...props} />);
  expect(ui.getAllByRole("radio")).toHaveLength(8);
  await fireEvent.changeText(
    ui.getByLabelText("调整原因补充说明"),
    "昨晚只睡了五小时",
  );
  await fireEvent.press(ui.getByRole("radio", { name: "疲劳或睡眠不足" }));
  await fireEvent.press(ui.getByRole("radio", { name: "联动后续课程" }));
  expect(props.onSubmit).not.toHaveBeenCalled();
  await fireEvent.press(ui.getByRole("radio", { name: "仅此课程" }));
  expect(ui.getByLabelText("调整原因补充说明").props.value).toBe(
    "昨晚只睡了五小时",
  );
  expect(
    ui.getByRole("radio", { name: "疲劳或睡眠不足" }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(props.onDirtyChange).toHaveBeenLastCalledWith(true);
  expect(ui.getByText("8/200")).toBeTruthy();
  await fireEvent.press(ui.getByRole("button", { name: "生成" }));
  expect(props.onSubmit).toHaveBeenCalledWith("FATIGUE", "昨晚只睡了五小时");
});

it("preserves selections after a generation error, locks editing while busy and restores it afterwards", async () => {
  const props = formProps();
  const ui = await render(<WorkoutAdjustmentForm {...props} />);
  await fireEvent.changeText(
    ui.getByLabelText("调整原因补充说明"),
    "今天只有二十分钟",
  );
  await fireEvent.press(ui.getByRole("radio", { name: "天气不适合" }));
  await fireEvent.press(ui.getByRole("radio", { name: "联动后续课程" }));
  await ui.rerender(<WorkoutAdjustmentForm {...props} loading />);
  for (const radio of ui.getAllByRole("radio")) expect(radio).toBeDisabled();
  expect(ui.getByRole("button", { name: "后续联动结束日期" })).toBeDisabled();
  expect(ui.getByLabelText("调整原因补充说明").props.editable).toBe(false);
  expect(ui.queryByRole("button", { name: "取消" })).toBeNull();
  expect(ui.getByRole("button", { name: "生成" })).toBeDisabled();
  await fireEvent.press(ui.getByRole("radio", { name: "仅此课程" }));
  await ui.rerender(<WorkoutAdjustmentForm {...props} error="生成暂时失败" />);
  expect(ui.getByText("生成暂时失败")).toBeTruthy();
  expect(ui.getByLabelText("调整原因补充说明").props.value).toBe(
    "今天只有二十分钟",
  );
  expect(ui.getByLabelText("调整原因补充说明").props.editable).toBe(true);
  expect(
    ui.getByRole("radio", { name: "天气不适合" }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(
    ui.getByRole("radio", { name: "联动后续课程" }).props.accessibilityState
      .checked,
  ).toBe(true);
});
