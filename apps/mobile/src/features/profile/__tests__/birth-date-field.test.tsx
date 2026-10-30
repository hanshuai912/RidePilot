import { useState } from "react";
import { Dimensions, Platform } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

import { BirthDateField } from "../components/BirthDateField";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(["ios", "android", "web"] as const)(
  "%s uses the same drawer and commits only on confirmation",
  async (platform) => {
    jest.replaceProperty(Platform, "OS", platform);
    const onChange = jest.fn();
    const screen = await render(
      <BirthDateField value="1990-01-15" onChange={onChange} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
    expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
      "1990年01月15日",
    );
    await fireEvent.press(screen.getByRole("radio", { name: "16日" }));
    expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
      "1990年01月16日",
    );
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "确认日期" }));
    expect(onChange).toHaveBeenCalledWith("1990-01-16");
    expect(screen.queryByTestId("birth-date-preview")).toBeNull();
  },
);

test.each(["取消选择", "取消日期选择", "关闭日期抽屉"])(
  "%s discards the selection and reopening restores the saved date",
  async (action) => {
    const onChange = jest.fn();
    const screen = await render(
      <BirthDateField value="1995-01-15" onChange={onChange} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
    await fireEvent.press(screen.getByRole("radio", { name: "1996年" }));
    await fireEvent.press(screen.getByRole("button", { name: action }));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
    expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
      "1995年01月15日",
    );
  },
);

test("Android back cancels an optional empty date", async () => {
  const onChange = jest.fn();
  const screen = await render(
    <BirthDateField value={null} onChange={onChange} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  await fireEvent(screen.getByTestId("birth-date-sheet"), "requestClose");
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText("请选择年、月、日")).toBeTruthy();
});

test("changing month and year clamps leap days before confirmation", async () => {
  const onChange = jest.fn();
  const screen = await render(
    <BirthDateField value="2000-01-31" onChange={onChange} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  await fireEvent.press(screen.getByRole("radio", { name: "2月" }));
  expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
    "2000年02月29日",
  );
  await fireEvent.press(screen.getByRole("radio", { name: "1999年" }));
  expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
    "1999年02月28日",
  );
  await fireEvent.press(screen.getByRole("button", { name: "确认日期" }));
  expect(onChange).toHaveBeenCalledWith("1999-02-28");
});

test("clearing restores the optional empty state", async () => {
  function Field() {
    const [value, setValue] = useState<string | null>("1990-01-15");
    return <BirthDateField value={value} onChange={setValue} />;
  }
  const screen = await render(<Field />);
  await fireEvent.press(screen.getByRole("button", { name: "清空出生日期" }));
  expect(screen.getByText("请选择年、月、日")).toBeTruthy();
});

test("saving disables date changes and drawer confirmation", async () => {
  const onChange = jest.fn();
  const screen = await render(
    <BirthDateField value="1990-01-15" onChange={onChange} disabled />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  expect(screen.queryByTestId("birth-date-preview")).toBeNull();
  expect(screen.getByRole("button", { name: "清空出生日期" })).toBeDisabled();
  await screen.rerender(
    <BirthDateField value="1990-01-15" onChange={onChange} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  await screen.rerender(
    <BirthDateField value="1990-01-15" onChange={onChange} disabled />,
  );
  expect(screen.getByRole("button", { name: "确认日期" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "确认日期" }));
  expect(onChange).not.toHaveBeenCalled();
});

function wheelScroll(index: number) {
  const rowHeight = Math.max(
    44,
    Math.ceil(48 * Dimensions.get("window").fontScale),
  );
  return {
    nativeEvent: {
      contentOffset: { x: 0, y: index * rowHeight },
      contentSize: { width: 100, height: 10000 },
      layoutMeasurement: { width: 100, height: 240 },
      zoomScale: 1,
    },
  };
}

test("scrolling all three wheels selects their centre values before confirming", async () => {
  const onChange = jest.fn();
  const screen = await render(
    <BirthDateField value="1990-01-15" onChange={onChange} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  await fireEvent(
    screen.getByTestId("birth-date-column-年"),
    "momentumScrollEnd",
    wheelScroll(100),
  );
  await fireEvent(
    screen.getByTestId("birth-date-column-月"),
    "momentumScrollEnd",
    wheelScroll(1),
  );
  await fireEvent(
    screen.getByTestId("birth-date-column-日"),
    "momentumScrollEnd",
    wheelScroll(28),
  );
  expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
    "2000年02月29日",
  );
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "确认日期" }));
  expect(onChange).toHaveBeenCalledWith("2000-02-29");
});

test("wheel endpoints keep the first and last valid day selectable", async () => {
  const onChange = jest.fn();
  const screen = await render(
    <BirthDateField value="1990-01-15" onChange={onChange} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  await fireEvent(
    screen.getByTestId("birth-date-column-日"),
    "momentumScrollEnd",
    wheelScroll(-1),
  );
  expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
    "1990年01月01日",
  );
  await fireEvent(
    screen.getByTestId("birth-date-column-日"),
    "momentumScrollEnd",
    wheelScroll(40),
  );
  expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
    "1990年01月31日",
  );
});

test("a fast fling keeps the current date stable until momentum stops", async () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const screen = await render(
    <BirthDateField value="1990-01-15" onChange={onChange} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  const year = screen.getByTestId("birth-date-column-年");
  await fireEvent(year, "scrollBeginDrag", wheelScroll(90));
  await fireEvent.scroll(year, wheelScroll(94));
  await fireEvent(year, "scrollEndDrag", wheelScroll(94));
  await fireEvent(year, "momentumScrollBegin", wheelScroll(94));
  await fireEvent.scroll(year, wheelScroll(98));
  await fireEvent.scroll(year, wheelScroll(102));
  await act(() => jest.advanceTimersByTime(250));
  expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
    "1990年01月15日",
  );
  expect(screen.getByRole("button", { name: "确认日期" })).toBeDisabled();
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent(year, "momentumScrollEnd", wheelScroll(102));
  expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
    "2002年01月15日",
  );
  expect(screen.getByRole("button", { name: "确认日期" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "确认日期" }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith("2002-01-15");
});

test("a drag without momentum settles to the centre before enabling confirmation", async () => {
  jest.useFakeTimers();
  const screen = await render(
    <BirthDateField value="1990-01-15" onChange={jest.fn()} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "选择出生日期" }));
  const day = screen.getByTestId("birth-date-column-日");
  await fireEvent(day, "scrollBeginDrag", wheelScroll(14));
  await fireEvent.scroll(day, wheelScroll(15));
  await fireEvent(day, "scrollEndDrag", wheelScroll(15));
  expect(screen.getByRole("button", { name: "确认日期" })).toBeDisabled();
  await act(() => jest.advanceTimersByTime(200));
  expect(screen.getByTestId("birth-date-preview")).toHaveTextContent(
    "1990年01月16日",
  );
  expect(screen.getByRole("button", { name: "确认日期" })).toBeEnabled();
});
