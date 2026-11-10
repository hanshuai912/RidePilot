import { useState } from "react";
import { Platform } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { GoalPlanningDates } from "../components/GoalPlanningDates";

function Dates({ disabled = false }: { disabled?: boolean }) {
  const [range, setRange] = useState({
    start: "2028-01-31",
    end: "2028-02-13",
  });
  return (
    <GoalPlanningDates
      startDate={range.start}
      endDate={range.end}
      today="2028-01-01"
      disabled={disabled}
      onChange={(start, end) => setRange({ start, end })}
    />
  );
}

afterEach(() => jest.restoreAllMocks());

test.each(["ios", "android", "web"] as const)(
  "%s uses a confirmed date selection and cancels temporary changes",
  async (platform) => {
    jest.replaceProperty(Platform, "OS", platform);
    const view = await render(<Dates />);
    const start = () => view.getByRole("button", { name: "开始日期" });
    await fireEvent.press(start());
    await fireEvent.press(view.getByRole("radio", { name: "2月" }));
    expect(view.getByTestId("date-picker-preview")).toHaveTextContent(
      "2028年2月29日",
    );
    expect(start().props.accessibilityValue.text).toBe("2028年1月31日");
    await fireEvent.press(view.getByRole("button", { name: "取消" }));
    await fireEvent.press(start());
    expect(view.getByTestId("date-picker-preview")).toHaveTextContent(
      "2028年1月31日",
    );
    await fireEvent.press(view.getByRole("radio", { name: "2月" }));
    await fireEvent.press(view.getByRole("button", { name: "确认日期" }));
    expect(start().props.accessibilityValue.text).toBe("2028年2月29日");
    expect(
      view.getByRole("button", { name: "结束日期" }).props.accessibilityValue
        .text,
    ).toBe("2028年3月13日");
  },
);

test("end picker excludes earlier dates and Android back cancels", async () => {
  const view = await render(<Dates />);
  expect(view.getByText("共 14 天")).toBeTruthy();
  expect(view.queryByRole("button", { name: /规划 (7|14|28) 天/ })).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "结束日期" }));
  await fireEvent.press(view.getByRole("radio", { name: "1月" }));
  expect(view.queryByRole("radio", { name: "30日" })).toBeNull();
  await fireEvent(view.getByTestId("date-picker-sheet"), "requestClose");
  expect(
    view.getByRole("button", { name: "结束日期" }).props.accessibilityValue
      .text,
  ).toBe("2028年2月13日");
});

test("a pending wheel prevents confirmation and a busy planner disables date changes", async () => {
  const view = await render(<Dates />);
  await fireEvent.press(view.getByRole("button", { name: "开始日期" }));
  await fireEvent(view.getByTestId("date-column-日"), "scrollBeginDrag");
  expect(view.getByRole("button", { name: "确认日期" })).toBeDisabled();
  await view.rerender(<Dates disabled />);
  expect(view.getByRole("button", { name: "开始日期" })).toBeDisabled();
  expect(view.getByRole("button", { name: "结束日期" })).toBeDisabled();
});

test("the end picker stops at the 365-day stage planning boundary", async () => {
  const view = await render(<Dates />);
  await fireEvent.press(view.getByRole("button", { name: "结束日期" }));
  await fireEvent.press(view.getByRole("radio", { name: "2029年" }));
  expect(view.queryByRole("radio", { name: "2月" })).toBeNull();
  expect(view.queryByRole("radio", { name: "30日" })).toBeNull();
  await fireEvent.press(view.getByRole("radio", { name: "29日" }));
  await fireEvent.press(view.getByRole("button", { name: "确认日期" }));
  expect(view.getByText("共 365 天")).toBeTruthy();
});
