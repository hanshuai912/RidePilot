import type { AiProposalResponse } from "@ridepilot/contracts";
import { View } from "react-native";
import { AppText, Card } from "../../../components/ui";
import { goalTypeLabels } from "../model/goal-lifecycle";

export function PlanningGoalsCard({
  goals,
  tradeoffs = [],
}: {
  goals?: AiProposalResponse["planningGoals"];
  tradeoffs?: string[];
}) {
  if (!goals?.length) return null;
  return (
    <Card className="gap-3 p-5">
      <AppText variant="card">本次综合目标</AppText>
      {goals.map((goal) => (
        <View key={goal.id} className="gap-1">
          <AppText
            variant="caption"
            className={
              goal.priority === "PRIMARY" ? "text-brand" : "text-secondary"
            }
          >
            {goal.priority === "PRIMARY" ? "主目标" : "次目标"} ·{" "}
            {goal.targetDate}
          </AppText>
          <AppText>{goal.description || goalTypeLabels[goal.type]}</AppText>
        </View>
      ))}
      {tradeoffs.length ? (
        <View className="gap-2 border-t border-divider pt-3">
          <AppText variant="card" className="text-warning">
            目标取舍
          </AppText>
          {tradeoffs.map((tradeoff, i) => (
            <AppText key={i}>{tradeoff}</AppText>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
