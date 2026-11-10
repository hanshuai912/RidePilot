import { View } from "react-native";
import { AppText, Card, Input } from "../../../components/ui";
import { GoalInfoButton } from "./GoalInfoButton";

export function GoalCompletionForm({
  criteria,
  evidence,
  disabled,
  onCriteriaChange,
  onEvidenceChange,
}: {
  criteria: string;
  evidence: string;
  disabled: boolean;
  onCriteriaChange: (value: string) => void;
  onEvidenceChange: (value: string) => void;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center">
        <AppText variant="section">达成条件</AppText>
        <GoalInfoButton
          title="达成条件说明"
          description="确认完成时，核对可观察的达成条件，并填写对应的实际结果或证据。两项均为必填，预览确认后一起保存；日期到期不会自动判定达成。"
        />
      </View>
      <Card className="gap-4 p-5">
        <View className="gap-2">
          <AppText variant="caption" className="text-secondary">
            如何判断达成
          </AppText>
          <Input
            accessibilityLabel="目标达成条件"
            placeholder="如：同一路线完成 100 km，记录用时与感受"
            value={criteria}
            onChangeText={onCriteriaChange}
            editable={!disabled}
            maxLength={300}
            multiline
            className="min-h-[96px]"
          />
        </View>
        <View className="gap-2">
          <AppText variant="caption" className="text-secondary">
            实际结果与证据
          </AppText>
          <Input
            accessibilityLabel="目标操作理由"
            placeholder="填写与达成条件对应的实际结果"
            value={evidence}
            onChangeText={onEvidenceChange}
            editable={!disabled}
            maxLength={300}
            multiline
            className="min-h-[96px]"
          />
        </View>
      </Card>
    </View>
  );
}
