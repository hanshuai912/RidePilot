import { View } from "react-native";
import type { GoalChange } from "@ridepilot/contracts";
import { AppText } from "../../../components/ui";
import { goalActionLabels } from "../model/goal-lifecycle";
import { GoalInfoButton } from "./GoalInfoButton";
import { GoalOption } from "./GoalOption";

export function GoalActionPicker({
  actions,
  value,
  disabled,
  onChange,
}: {
  actions: GoalChange["action"][];
  value: GoalChange["action"];
  disabled: boolean;
  onChange: (value: GoalChange["action"]) => void;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center">
        <AppText variant="section">本次操作</AppText>
        <GoalInfoButton
          title="目标操作说明"
          description="目标调整、暂停、恢复、完成或结束均需先预览影响，再确认保存。未来课程、测试和饮食按原安排执行，需要另行确认调整。确认完成须有达成条件和实际证据；已结束的目标保留历史，可建立下一目标。"
        />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {actions.map((action) => (
          <GoalOption
            key={action}
            label={goalActionLabels[action]}
            accessibilityLabel={goalActionLabels[action]}
            selected={value === action}
            disabled={disabled}
            danger={action === "CLOSE"}
            onPress={() => onChange(action)}
          />
        ))}
      </View>
    </View>
  );
}
