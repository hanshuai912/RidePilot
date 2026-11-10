import { useState } from "react";
import { View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import type { useGoalPlanning } from "../hooks/useGoalPlanning";
import { GoalPlanningDates } from "./GoalPlanningDates";
import { StagePlanHeading } from "./StagePlanHeading";

export function GoalStagePlanner({
  flow,
  onEdit,
}: {
  flow: ReturnType<typeof useGoalPlanning>;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const days =
    (Date.parse(flow.stageEndDate) - Date.parse(flow.stageStartDate)) /
      86400000 +
    1;
  const valid =
    Number.isInteger(days) &&
    days >= 1 &&
    days <= 365 &&
    flow.stageStartDate >= (flow.data?.today ?? "");
  return (
    <View className="gap-4">
      <StagePlanHeading
        summary={flow.data?.stages?.summary}
        action={{
          label: flow.data?.stages ? "重新规划阶段" : "规划阶段",
          expanded,
          disabled: flow.busy,
          onPress: () => setExpanded((value) => !value),
        }}
      />
      {expanded ? (
        <Card className="gap-4 p-5" testID="goal-stage-planner">
          <GoalPlanningDates
            label="阶段日期"
            startLabel="阶段开始日期"
            endLabel="阶段结束日期"
            startDate={flow.stageStartDate}
            endDate={flow.stageEndDate}
            today={flow.data?.today ?? flow.stageStartDate}
            disabled={flow.busy}
            onChange={(start, end) => {
              onEdit();
              flow.setStageStartDate(start);
              flow.setStageEndDate(end);
            }}
          />
          <AppText variant="caption" className="text-secondary">
            最长 365 天，确认草稿后更新阶段安排，已有课程保留。
          </AppText>
          <Button
            disabled={flow.busy || !valid}
            onPress={() => void flow.generate("STAGES", !!flow.data?.stages)}
          >
            生成阶段草稿
          </Button>
        </Card>
      ) : null}
    </View>
  );
}
