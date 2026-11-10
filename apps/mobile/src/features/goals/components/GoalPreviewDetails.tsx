import { View } from "react-native";
import type { GoalChangePreview, GoalInput } from "@ridepilot/contracts";
import { AppText, Badge } from "../../../components/ui";
import { goalTypeLabels } from "../model/goal-lifecycle";
import { goalDateLabel } from "../model/goal-presentation";

function GoalValues({
  goal,
  label,
  showCriteria = false,
}: {
  goal: GoalInput;
  label?: string;
  showCriteria?: boolean;
}) {
  return (
    <View className="gap-3 rounded-xl bg-surface-2 p-4">
      {label ? (
        <AppText variant="caption" className="text-secondary">
          {label}
        </AppText>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText variant="card">{goalTypeLabels[goal.type]}</AppText>
        <Badge>{goal.priority === "PRIMARY" ? "主目标" : "次目标"}</Badge>
      </View>
      <AppText className="tabular-nums text-secondary">
        {goalDateLabel(goal.targetDate)}
      </AppText>
      {goal.description ? (
        <AppText className="text-secondary">{goal.description}</AppText>
      ) : null}
      {showCriteria ? (
        <View className="gap-1">
          <AppText variant="caption" className="text-secondary">
            达成条件
          </AppText>
          <AppText>{goal.successCriteria || "未填写"}</AppText>
        </View>
      ) : null}
      {goal.type === "FTP" &&
      ((goal.targetFtpWatts !== null && goal.targetFtpWatts !== undefined) ||
        (goal.targetWkg !== null && goal.targetWkg !== undefined)) ? (
        <View className="flex-row flex-wrap gap-2">
          {goal.targetFtpWatts ? (
            <Badge variant="brand">目标 {goal.targetFtpWatts} W</Badge>
          ) : null}
          {goal.targetWkg ? (
            <Badge variant="brand">目标 {goal.targetWkg} W/kg</Badge>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
export function GoalPreviewDetails({
  comparison,
  input,
  reason,
}: {
  comparison?: GoalChangePreview;
  input: GoalInput | null;
  reason: string;
}) {
  if (!comparison) return input ? <GoalValues goal={input} /> : null;
  const status = { ACTIVE: "进行中", PAUSED: "已暂停", CLOSED: "已结束" };
  const completing =
    comparison.before.status !== "CLOSED" &&
    comparison.after.status === "CLOSED" &&
    comparison.after.closureReason === "COMPLETED";
  return (
    <View className="gap-4">
      <GoalValues
        goal={comparison.before}
        label="原目标"
        showCriteria={completing}
      />
      <GoalValues
        goal={comparison.nextGoal ?? comparison.after}
        label={comparison.nextGoal ? "下一目标" : "确认后"}
        showCriteria={completing}
      />
      <View className="gap-2">
        <AppText variant="caption" className="text-secondary">
          状态变化
        </AppText>
        <AppText>
          {status[comparison.before.status]} →{" "}
          {comparison.after.closureReason === "COMPLETED"
            ? "用户确认完成"
            : status[comparison.after.status]}
        </AppText>
      </View>
      <View className="gap-2">
        <AppText variant="caption" className="text-secondary">
          {completing ? "实际结果与证据" : "操作理由"}
        </AppText>
        <AppText>{reason}</AppText>
      </View>
      <View className="gap-3 border-t border-divider pt-4">
        <AppText variant="card">影响范围</AppText>
        <View className="flex-row flex-wrap gap-2">
          <Badge>课程 {comparison.affected.workouts.length} 节</Badge>
          <Badge>测试 {comparison.affected.assessments.length} 项</Badge>
          <Badge>阶段 {comparison.affected.stages.length} 项</Badge>
        </View>
        {comparison.affected.workouts.map((workout) => (
          <AppText key={workout.id} className="text-secondary">
            保留 {workout.date} · {workout.title}
          </AppText>
        ))}
        {comparison.affected.assessments.map((assessment) => (
          <AppText key={assessment.id} className="text-secondary">
            测试保留 {assessment.date} · {assessment.title}
          </AppText>
        ))}
        {comparison.affected.stages.map((stage) => (
          <AppText key={stage.id} className="text-secondary">
            需重新核对阶段：{stage.title}
          </AppText>
        ))}
        {comparison.affected.otherPrimaryGoals.map((goal) => (
          <AppText key={goal.id} className="text-warning">
            {goal.description || goalTypeLabels[goal.type]}：主目标 → 次目标
          </AppText>
        ))}
      </View>
    </View>
  );
}
