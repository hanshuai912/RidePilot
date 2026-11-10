import { screen, fireEvent } from "expo-router/testing-library";

// Exercise the same wheel/confirmation path users use instead of changing props.
export async function selectPlanningDate(label: string, date: string) {
  const [year, month, day] = date.split("-").map(Number);
  await fireEvent.press(await screen.findByRole("button", { name: label }));
  await fireEvent.press(screen.getByRole("radio", { name: `${year}年` }));
  await fireEvent.press(screen.getByRole("radio", { name: `${month}月` }));
  await fireEvent.press(screen.getByRole("radio", { name: `${day}日` }));
  await fireEvent.press(screen.getByRole("button", { name: "确认日期" }));
}
