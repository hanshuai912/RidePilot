import { View } from "react-native";
import { AppText, Badge, Button, Card } from "../../../components/ui";
import { goalTypeLabels } from "../model/goal-lifecycle";
import {
  goalDateLabel,
  goalStatusLabel,
  type GoalRecord,
} from "../model/goal-presentation";

export function GoalSummaryCard({
  goal,
  currentFtp,
  busy,
  onManage,
}: {
  goal: GoalRecord;
  currentFtp?: number;
  busy: boolean;
  onManage: () => void;
}) {
  return (
    <Card className="p-5" testID="goal-summary">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Badge variant={goal.status === "ACTIVE" ? "brand" : "neutral"}>
          {goal.priority === "PRIMARY" ? "主目标" : "次目标"} ·{" "}
          {goalStatusLabel(goal)}
        </Badge>
        <Button variant="ghost" size="sm" disabled={busy} onPress={onManage}>
          管理目标
        </Button>
      </View>
      <AppText variant="card" className="mt-3">
        {goalTypeLabels[goal.type]}
      </AppText>
      {goal.description && goal.description !== goalTypeLabels[goal.type] ? (
        <AppText className="mt-2 text-secondary">{goal.description}</AppText>
      ) : null}
      {goal.targetFtpWatts || goal.targetWkg ? (
        <View className="mt-4 flex-row flex-wrap gap-x-6 gap-y-3">
          {goal.targetFtpWatts ? (
            <View>
              <AppText variant="label" className="text-secondary">
                目标 FTP
              </AppText>
              <View className="mt-1 flex-row items-baseline gap-1">
                <AppText variant="display" className="tabular-nums text-brand">
                  {goal.targetFtpWatts}
                </AppText>
                <AppText variant="caption" className="text-secondary">
                  W
                </AppText>
              </View>
            </View>
          ) : null}
          {goal.targetWkg ? (
            <View>
              <AppText variant="label" className="text-secondary">
                目标功体比
              </AppText>
              <View className="mt-1 flex-row items-baseline gap-1">
                <AppText variant="display" className="tabular-nums text-brand">
                  {goal.targetWkg}
                </AppText>
                <AppText variant="caption" className="text-secondary">
                  W/kg
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      <View className="mt-4 gap-2 border-t border-divider pt-3">
        <AppText variant="caption" className="tabular-nums text-secondary">
          目标日期 · {goalDateLabel(goal.targetDate)}
        </AppText>
        <AppText variant="caption" className="tabular-nums text-secondary">
          {currentFtp ? `当前 FTP ${currentFtp} W` : "尚未设置 FTP"}
        </AppText>
      </View>
      {goal.successCriteria ? (
        <View className="mt-4 rounded-xl bg-surface-2 p-3">
          <AppText variant="label" className="text-secondary">
            达成条件
          </AppText>
          <AppText className="mt-1">{goal.successCriteria}</AppText>
        </View>
      ) : (
        <AppText variant="caption" className="mt-3 text-secondary">
          达成条件待补充
        </AppText>
      )}
    </Card>
  );
}
