import { useState } from "react";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import type { ComponentProps } from "react";
import { Button, Dialog } from "../../../components/ui";

export function useUnsavedTraining(
  dirty: boolean,
  description = "返回后本次修改仍保留在当前训练流程内，退出应用后无法恢复。",
  busy = false,
) {
  const navigation = useNavigation();
  const [leave, setLeave] = useState<(() => void) | null>(null);
  usePreventRemove(dirty || busy, ({ data }) => {
    if (busy) return;
    setLeave(() => () => navigation.dispatch(data.action));
  });
  const props: ComponentProps<typeof Dialog> = {
    visible: leave !== null,
    title: "还有未保存的课程修改",
    description,
    onClose: () => setLeave(null),
    children: (
      <Button
        onPress={() => {
          const action = leave;
          setLeave(null);
          action?.();
        }}
      >
        确认返回
      </Button>
    ),
  };
  return <Dialog {...props} />;
}
