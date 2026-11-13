import { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PlanningBrief } from "../components/PlanningBrief";
import type { PlanningScope } from "../services/adjustment-scope";

function RecoveryForm({ busy = false }: { busy?: boolean }) {
  const [scope, setScope] = useState<PlanningScope>("NEXT_WEEK");
  const [status, setStatus] = useState<"READY" | "TIRED" | "RECOVERY">("READY");
  const [note, setNote] = useState("");
  return (
    <PlanningBrief
      task="RECOVERY"
      planningScope={scope}
      setPlanningScope={setScope}
      bodyStatus={status}
      setBodyStatus={setStatus}
      taskNote={note}
      setTaskNote={setNote}
      planStatus={{ hasActivePlan: true, planVersion: 3 }}
      goalLabel="提升耐力"
      onEditGoal={jest.fn()}
      busy={busy}
    />
  );
}

it("keeps recovery selections independent and retains the race note when switching scope or body status", async () => {
  const ui = await render(<RecoveryForm />);
  expect(ui.getByTestId("coach-recovery-brief")).toBeTruthy();
  expect(ui.queryByTestId("coach-replan-brief")).toBeNull();
  expect(ui.queryByText("整个训练周期")).toBeNull();
  expect(ui.getAllByRole("radio")).toHaveLength(6);
  expect(
    ui.getByRole("radio", { name: "下周" }).props.accessibilityState.checked,
  ).toBe(true);
  expect(
    ui.getByRole("radio", { name: "感觉正常" }).props.accessibilityState
      .checked,
  ).toBe(true);
  const note = "周日完成 100 公里公路赛，目前双腿酸胀";
  await fireEvent.changeText(ui.getByLabelText("比赛与恢复情况"), note);
  await fireEvent.press(ui.getByRole("radio", { name: "本周剩余" }));
  expect(ui.getByText("调整本周尚未完成的训练安排。")).toBeTruthy();
  await fireEvent.press(ui.getByRole("radio", { name: "需要充分恢复" }));
  expect(
    ui.getByRole("radio", { name: "需要充分恢复" }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(
    ui.getByRole("radio", { name: "本周剩余" }).props.accessibilityState
      .checked,
  ).toBe(true);
  await fireEvent.press(ui.getByRole("radio", { name: "下一节" }));
  expect(ui.getByText("只调整最近一节尚未完成的训练。")).toBeTruthy();
  await fireEvent.press(ui.getByRole("radio", { name: "仍有疲劳" }));
  expect(
    ui.getByRole("radio", { name: "需要充分恢复" }).props.accessibilityState
      .checked,
  ).toBe(false);
  expect(ui.getByLabelText("比赛与恢复情况").props.value).toBe(note);
  expect(ui.getByText(`${note.length}/240`)).toBeTruthy();
  expect(ui.getByText(/基于正式计划 v3/)).toBeTruthy();
});

it("locks recovery inputs while submitting and restores editing without losing the note", async () => {
  const ui = await render(<RecoveryForm />);
  await fireEvent.changeText(
    ui.getByLabelText("比赛与恢复情况"),
    "保留赛后描述",
  );
  await ui.rerender(<RecoveryForm busy />);
  for (const radio of ui.getAllByRole("radio"))
    expect(radio.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(ui.getByRole("radio", { name: "仍有疲劳" }));
  expect(
    ui.getByRole("radio", { name: "感觉正常" }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(ui.getByLabelText("比赛与恢复情况").props.editable).toBe(false);
  await ui.rerender(<RecoveryForm />);
  expect(ui.getByLabelText("比赛与恢复情况").props.value).toBe("保留赛后描述");
  expect(ui.getByLabelText("比赛与恢复情况").props.editable).toBe(true);
});
