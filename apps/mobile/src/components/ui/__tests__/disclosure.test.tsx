import { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Disclosure } from "../Disclosure";
import { Input } from "../Input";

function LocalForm() {
  const [value, setValue] = useState("");
  return (
    <Input
      accessibilityLabel="比赛备注"
      value={value}
      onChangeText={setValue}
    />
  );
}

test("a foldable form retains unsaved local inputs and hides them from accessibility while closed", async () => {
  const view = await render(
    <Disclosure title="记录结果" keepMounted>
      <LocalForm />
    </Disclosure>,
  );
  const toggle = view.getByRole("button", { name: "记录结果" });
  expect(view.queryByLabelText("比赛备注")).toBeNull();
  await fireEvent.press(toggle);
  await fireEvent.changeText(
    view.getByLabelText("比赛备注"),
    "最后爬坡比较吃力",
  );
  await fireEvent.press(toggle);
  expect(toggle.props.accessibilityState.expanded).toBe(false);
  expect(view.queryByLabelText("比赛备注")).toBeNull();
  await fireEvent.press(toggle);
  expect(view.getByLabelText("比赛备注").props.value).toBe("最后爬坡比较吃力");
});
