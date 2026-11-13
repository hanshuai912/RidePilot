import { View } from "react-native";
import type { ReactNode } from "react";
import type { GoalInput } from "@ridepilot/contracts";
import { AppText, Input, Card } from "../../../components/ui";
import { GoalInfoButton } from "./GoalInfoButton";
import { GoalOption } from "./GoalOption";
import { goalTypeLabels, type GoalFormValue } from "../model/goal-lifecycle";

export function GoalForm({
  value,
  onChange,
  disabled,
  priorityControl,
}: {
  value: GoalFormValue;
  onChange: (value: GoalFormValue) => void;
  disabled: boolean;
  priorityControl?: ReactNode;
}) {
  const set = (key: keyof GoalFormValue, text: string) =>
    onChange({ ...value, [key]: text });
  return (
    <View className="gap-6">
      <View className="gap-3">
        <AppText variant="section">目标条件</AppText>
        <Card className="gap-4 p-5">
          <View className="gap-2">
            <AppText variant="caption" className="text-secondary">
              目标方向
            </AppText>
            <View className="flex-row flex-wrap gap-2">
              {(Object.keys(goalTypeLabels) as GoalInput["type"][]).map(
                (type) => (
                  <GoalOption
                    key={type}
                    label={goalTypeLabels[type]}
                    selected={value.type === type}
                    disabled={disabled}
                    onPress={() => set("type", type)}
                  />
                ),
              )}
            </View>
          </View>
          {priorityControl}
          <AppText variant="caption" className="text-secondary">
            根据实际训练、疲劳反馈和阶段复评逐步推进目标。
          </AppText>
          {value.type === "FTP" ? (
            <View className="gap-3 border-t border-divider pt-2">
              <View className="flex-row items-center">
                <AppText variant="card">目标指标</AppText>
                <GoalInfoButton
                  title="目标指标说明"
                  description="FTP 与功体比均为选填。FTP 范围为 50–800 W，功体比为 1–10 W/kg。同时填写时，规划优先使用目标 FTP，功体比差距按当前体重单独核对。"
                />
              </View>
              <View className="gap-2">
                <AppText variant="caption" className="text-secondary">
                  目标 FTP（W，选填）
                </AppText>
                <Input
                  accessibilityLabel="目标 FTP"
                  keyboardType="numeric"
                  value={value.targetFtpWatts}
                  onChangeText={(text) => set("targetFtpWatts", text)}
                  editable={!disabled}
                />
              </View>
              <View className="gap-2">
                <AppText variant="caption" className="text-secondary">
                  目标功体比（W/kg，选填）
                </AppText>
                <Input
                  accessibilityLabel="目标功体比"
                  keyboardType="decimal-pad"
                  value={value.targetWkg}
                  onChangeText={(text) => set("targetWkg", text)}
                  editable={!disabled}
                />
              </View>
            </View>
          ) : null}
          <View className="gap-2">
            <AppText variant="caption" className="text-secondary">
              目标说明（选填）
            </AppText>
            <Input
              accessibilityLabel="目标说明"
              value={value.description}
              onChangeText={(text) => set("description", text)}
              editable={!disabled}
              maxLength={200}
              multiline
            />
          </View>
        </Card>
      </View>
    </View>
  );
}
