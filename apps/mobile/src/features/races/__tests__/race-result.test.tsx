import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { RaceResultCard } from "../components/RaceResultCard";

test("result correction submits the displayed result version and preserves actual values", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const result = {
    id: "result",
    raceId: "race",
    status: "PARTIAL" as const,
    actualDate: "2026-11-01",
    durationSeconds: 1200,
    rpe: 7,
    fatigue: 8,
    notes: "疲劳",
    version: 2,
  };
  const view = await render(
    <RaceResultCard
      raceId="race"
      raceDate="2026-11-01"
      result={result}
      busy={false}
      onSave={save}
    />,
  );
  await fireEvent.changeText(view.getByLabelText("比赛用时"), "1500");
  await fireEvent.press(view.getByText("更新结果"));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "PARTIAL",
      durationSeconds: 1500,
      fatigue: 8,
      expectedVersion: 2,
    }),
  );
});

test("invalid scores keep the entered form and do not write results", async () => {
  const save = jest.fn();
  const view = await render(
    <RaceResultCard
      raceId="race"
      raceDate="2026-11-01"
      result={null}
      busy={false}
      onSave={save}
    />,
  );
  await fireEvent.changeText(view.getByLabelText("比赛疲劳"), "20");
  await fireEvent.press(view.getByText("保存结果"));
  await waitFor(() => expect(view.getByText(/请检查实际日期/)).toBeTruthy());
  expect(save).not.toHaveBeenCalled();
});
