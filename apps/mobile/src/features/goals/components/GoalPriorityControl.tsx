import { View } from "react-native";
import type { GoalInput } from "@ridepilot/contracts";
import { AppText, Badge, Button } from "../../../components/ui";
import { GoalInfoButton } from "./GoalInfoButton";

export function GoalPriorityControl({
  value,
  canPromote,
  disabled,
  onChange,
}: {
  value: GoalInput["priority"];
  canPromote: boolean;
  disabled: boolean;
  onChange: (value: GoalInput["priority"]) => void;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <AppText variant="caption" className="text-secondary">
            优先级
          </AppText>
          <GoalInfoButton
            title="目标优先级说明"
            description="主目标是当前优先关注的训练方向。新增目标保留现有主目标；需要切换时，在该目标的编辑页选择设为主目标，预览确认后原主目标变为次目标。正式课程不会自动改变。"
          />
        </View>
        <Badge variant={value === "PRIMARY" ? "brand" : "neutral"}>
          {value === "PRIMARY" ? "主目标" : "次目标"}
        </Badge>
      </View>
      {canPromote ? (
        <Button
          variant="secondary"
          disabled={disabled}
          onPress={() =>
            onChange(value === "PRIMARY" ? "SECONDARY" : "PRIMARY")
          }
        >
          {value === "PRIMARY" ? "取消设为主目标" : "设为主目标"}
        </Button>
      ) : null}
    </View>
  );
}
