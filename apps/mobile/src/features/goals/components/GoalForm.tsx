import { View } from "react-native";
import type { GoalInput } from "@ridepilot/contracts";
import { AppText, Input, Card } from "../../../components/ui";
import { ChoicePill } from "../../coach/components/CoachPage";
import { goalTypeLabels, type GoalFormValue } from "../model/goal-lifecycle";

export function GoalForm({
  value,
  onChange,
  disabled,
}: {
  value: GoalFormValue;
  onChange: (value: GoalFormValue) => void;
  disabled: boolean;
}) {
  const set = (key: keyof GoalFormValue, text: string) =>
    onChange({ ...value, [key]: text });
  return (
    <Card>
      <AppText variant="card">目标条件</AppText>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {(Object.keys(goalTypeLabels) as GoalInput["type"][]).map((type) => (
          <ChoicePill
            key={type}
            label={goalTypeLabels[type]}
            selected={value.type === type}
            onPress={() => {
              if (!disabled) set("type", type);
            }}
          />
        ))}
      </View>
      <AppText muted className="mt-3">
        目标说明（选填）
      </AppText>
      <Input
        accessibilityLabel="目标说明"
        value={value.description}
        onChangeText={(v) => set("description", v)}
        editable={!disabled}
        maxLength={200}
      />
      <AppText muted className="mt-3">
        期望日期
      </AppText>
      <Input
        accessibilityLabel="目标日期"
        placeholder="YYYY-MM-DD"
        value={value.targetDate}
        onChangeText={(v) => set("targetDate", v)}
        editable={!disabled}
      />
      <AppText muted className="mt-3">
        可观察的达成条件
      </AppText>
      <Input
        accessibilityLabel="目标达成条件"
        placeholder="例如：在相同路线和条件下完成 100 km，并记录实际用时与主观感受"
        value={value.successCriteria}
        onChangeText={(v) => set("successCriteria", v)}
        editable={!disabled}
        maxLength={300}
        multiline
      />
      <AppText variant="caption" muted className="mt-2">
        可以稍后补充。确认完成前须填写，并说明实际证据；日期到期不会自动判定达成。
      </AppText>
      {value.type === "FTP" ? (
        <>
          <AppText muted className="mt-3">
            目标 FTP（选填，W）
          </AppText>
          <Input
            accessibilityLabel="目标 FTP"
            keyboardType="numeric"
            value={value.targetFtpWatts}
            onChangeText={(v) => set("targetFtpWatts", v)}
            editable={!disabled}
          />
          <AppText muted className="mt-3">
            目标功体比（选填，W/kg）
          </AppText>
          <Input
            accessibilityLabel="目标功体比"
            keyboardType="decimal-pad"
            value={value.targetWkg}
            onChangeText={(v) => set("targetWkg", v)}
            editable={!disabled}
          />
          <AppText muted variant="caption" className="mt-2">
            同时填写时，规划优先使用目标 FTP；功体比差距按当前体重单独核对。
          </AppText>
        </>
      ) : null}
      <View className="mt-3 flex-row gap-2">
        {(["PRIMARY", "SECONDARY"] as const).map((priority) => (
          <ChoicePill
            key={priority}
            label={priority === "PRIMARY" ? "主目标" : "次目标"}
            selected={value.priority === priority}
            onPress={() => {
              if (!disabled) set("priority", priority);
            }}
          />
        ))}
      </View>
    </Card>
  );
}
