import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { AppText } from "../AppText";
import { Card } from "../Card";
import { Button } from "../Button";
import { Input } from "../Input";
import { AppHeader } from "../../layout/AppHeader";
import { NavigationHeader } from "../../layout/NavigationHeader";
import { NavigationHeaderAction } from "../../layout/NavigationHeaderAction";
import { colors } from "../../../theme/colors";

it("uses the same page heading size in compact and regular headers", async () => {
  const screen = await render(
    <>
      <AppHeader compact title="首页" />
      <AppHeader title="训练" />
    </>,
  );
  for (const title of screen.getAllByRole("header")) {
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      fontSize: 28,
      lineHeight: 34,
    });
  }
});

it("distinguishes navigation, content headings and readable body copy", async () => {
  const screen = await render(
    <>
      <NavigationHeader title="个人信息" onBack={jest.fn()} />
      <AppText variant="section">训练安排</AppText>
      <AppText>建立稳定的训练习惯</AppText>
      <AppText variant="caption">基于近期训练记录</AppText>
    </>,
  );
  for (const [label, size, height] of [
    ["个人信息", 17, 24],
    ["训练安排", 18, 24],
    ["建立稳定的训练习惯", 16, 24],
    ["基于近期训练记录", 14, 20],
  ] as const) {
    const text = screen.getByText(label);
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({
      fontSize: size,
      lineHeight: height,
    });
    expect(text.props.allowFontScaling).not.toBe(false);
  }
});

it("preserves explicit caller styles and accessibility properties", async () => {
  const screen = await render(
    <AppText
      accessibilityRole="alert"
      style={{ color: colors.warning, textAlign: "center" }}
    >
      连接失败，请重试
    </AppText>,
  );
  const text = screen.getByRole("alert");
  expect(StyleSheet.flatten(text.props.style)).toMatchObject({
    fontSize: 16,
    lineHeight: 24,
    color: colors.warning,
    textAlign: "center",
  });
  expect(text.props.maxFontSizeMultiplier).toBeUndefined();
});

it("keeps inputs and button copy readable and lets long button text wrap", async () => {
  const screen = await render(
    <>
      <Input accessibilityLabel="昵称" style={{ minHeight: 54 }} />
      <Button>确认并预览接下来的训练调整</Button>
    </>,
  );
  expect(
    StyleSheet.flatten(screen.getByLabelText("昵称").props.style),
  ).toMatchObject({ fontSize: 16, lineHeight: 24, minHeight: 54 });
  const label = screen.getByText("确认并预览接下来的训练调整");
  expect(StyleSheet.flatten(label.props.style)).toMatchObject({
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  });
  expect(label.props.numberOfLines).toBeUndefined();
  expect(label.props.allowFontScaling).not.toBe(false);
});

it("keeps compact header actions horizontal and prevents duplicate submissions", async () => {
  const onPress = jest.fn();
  const screen = await render(
    <NavigationHeaderAction label="保存" onPress={onPress} />,
  );
  const label = screen.getByText("保存");
  expect(label.props.numberOfLines).toBe(1);
  expect(label.props.maxFontSizeMultiplier).toBe(1.35);
  await fireEvent.press(screen.getByRole("button", { name: "保存" }));
  expect(onPress).toHaveBeenCalledTimes(1);
  await screen.rerender(
    <NavigationHeaderAction label="保存" loading onPress={onPress} />,
  );
  expect(
    screen.getByRole("button", { name: "保存" }).props.accessibilityState,
  ).toEqual({ disabled: true, busy: true });
  expect(screen.getByLabelText("正在保存")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "保存" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

function luminance(hex: string) {
  const components = hex
    .slice(1)
    .match(/../g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return (
    components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722
  );
}
it("keeps normal primary, secondary and muted text above 4.5:1 on app surfaces", () => {
  for (const background of [
    colors.background,
    colors.surface1,
    colors.surface2,
    colors.surfaceElevated,
  ]) {
    for (const foreground of [
      colors.textPrimary,
      colors.textSecondary,
      colors.textMuted,
    ]) {
      expect(
        (luminance(foreground) + 0.05) / (luminance(background) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});

it("lets semantic colors and emphasis replace defaults without conflicting utilities", async () => {
  const screen = await render(
    <AppText variant="card" className="text-brand font-normal">
      目标功率
    </AppText>,
  );
  const text = screen.getByText("目标功率");
  expect(text.props.className).toContain("text-brand");
  expect(text.props.className).not.toContain("text-primary");
  expect(text.props.className).not.toContain("font-semibold");
});

it("does not add default card padding over an explicit page spacing choice", async () => {
  const screen = await render(<Card testID="card" className="p-5" />);
  expect(screen.getByTestId("card").props.className.split(/\s+/)).not.toContain(
    "p-4",
  );
  await screen.rerender(<Card testID="card" padding="none" />);
  expect(screen.getByTestId("card").props.className).toContain("p-0");
});
