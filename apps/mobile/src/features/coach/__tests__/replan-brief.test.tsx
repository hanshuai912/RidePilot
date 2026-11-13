import { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PlanningBrief } from "../components/PlanningBrief";
import type { PlanningScope } from "../services/adjustment-scope";

function ReplanForm({ busy = false }: { busy?: boolean }) {
  const [scope, setScope] = useState<PlanningScope>("NEXT_WEEK");
  const [note, setNote] = useState("");
  return (
    <PlanningBrief
      task="REPLAN"
      planningScope={scope}
      setPlanningScope={setScope}
      bodyStatus="READY"
      setBodyStatus={jest.fn()}
      taskNote={note}
      setTaskNote={setNote}
      planStatus={{ hasActivePlan: true, planVersion: 3 }}
      goalLabel="提升耐力"
      onEditGoal={jest.fn()}
      busy={busy}
    />
  );
}

it("appends editable reasons without replacing typed details or losing them when changing scope", async () => {
  const ui = await render(<ReplanForm />);
  const input = ui.getByLabelText("训练调整说明");
  const typed = "周二只能练 40 分钟";
  const reason = "可训练时间减少，希望缩短单次训练。";
  await fireEvent.changeText(input, typed);
  await fireEvent.press(ui.getByRole("button", { name: "时间不足" }));
  expect(input.props.value).toBe(`${typed}\n${reason}`);
  expect(ui.getByRole("button", { name: "时间不足" })).toBeDisabled();
  await fireEvent.press(ui.getByRole("button", { name: "时间不足" }));
  expect(input.props.value).toBe(`${typed}\n${reason}`);
  await fireEvent.press(ui.getByRole("radio", { name: "本周剩余训练" }));
  expect(input.props.value).toBe(`${typed}\n${reason}`);
  expect(ui.getByText("调整本周尚未完成的训练，已完成记录保留。")).toBeTruthy();
  await fireEvent.changeText(input, typed);
  expect(ui.getByRole("button", { name: "时间不足" })).toBeEnabled();
  await fireEvent.press(ui.getByRole("button", { name: "强度偏高" }));
  expect(input.props.value).toBe(
    `${typed}\n目前训练强度偏高，希望适当降低强度。`,
  );
});

it("disables reason shortcuts that would exceed the limit instead of truncating user input", async () => {
  const ui = await render(<ReplanForm />);
  const input = ui.getByLabelText("训练调整说明");
  const typed = "保持我的训练说明".repeat(30).slice(0, 239);
  await fireEvent.changeText(input, typed);
  for (const label of [
    "时间不足",
    "强度偏高",
    "训练环境变化",
    "调整训练重点",
  ]) {
    expect(ui.getByRole("button", { name: label })).toBeDisabled();
    await fireEvent.press(ui.getByRole("button", { name: label }));
  }
  expect(input.props.value).toBe(typed);
  expect(ui.getByText("239/240")).toBeTruthy();
  await fireEvent.changeText(input, "");
  expect(ui.getByRole("button", { name: "时间不足" })).toBeEnabled();
});

it("locks all editing while generating and restores the same form after a failure", async () => {
  const ui = await render(<ReplanForm />);
  await fireEvent.changeText(
    ui.getByLabelText("训练调整说明"),
    "保留周末长距离",
  );
  await ui.rerender(<ReplanForm busy />);
  for (const radio of ui.getAllByRole("radio")) expect(radio).toBeDisabled();
  for (const button of ui.getAllByRole("button")) expect(button).toBeDisabled();
  expect(ui.getByLabelText("训练调整说明").props.editable).toBe(false);
  await fireEvent.press(ui.getByRole("radio", { name: "下一节训练" }));
  await fireEvent.press(ui.getByRole("button", { name: "时间不足" }));
  await ui.rerender(<ReplanForm />);
  expect(ui.getByLabelText("训练调整说明").props.value).toBe("保留周末长距离");
  expect(ui.getByLabelText("训练调整说明").props.editable).toBe(true);
  expect(
    ui.getByRole("radio", { name: "从下周开始" }).props.accessibilityState
      .checked,
  ).toBe(true);
});
