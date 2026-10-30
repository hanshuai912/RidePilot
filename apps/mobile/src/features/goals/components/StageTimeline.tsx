import type { StagePlanResponse } from "@ridepilot/contracts";
import { View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";

export function StageTimeline({
  plan,
  selectedId,
  onSelect,
  today,
}: {
  plan: StagePlanResponse;
  selectedId?: string;
  onSelect?: (id: string) => void;
  today?: string;
}) {
  return (
    <>
      <AppText variant="body">{plan.summary}</AppText>
      {plan.stale ? (
        <AppText className="text-warning">
          目标或训练资料已变化，请重新生成阶段安排。
        </AppText>
      ) : null}
      {plan.stages.map((stage) => (
        <Card key={stage.id}>
          <View className="flex-row justify-between gap-2">
            <AppText variant="label" className="text-brand">
              阶段 {stage.position + 1}
            </AppText>
            <AppText variant="caption" muted>
              {today && stage.endDate < today
                ? "已结束"
                : today && stage.startDate <= today
                  ? "当前阶段"
                  : "后续阶段"}
            </AppText>
          </View>
          <AppText variant="card" className="mt-2">
            {stage.title}
          </AppText>
          <AppText variant="caption" muted className="mt-2">
            {stage.startDate} 至 {stage.endDate}
          </AppText>
          <AppText className="mt-2">{stage.purpose}</AppText>
          <AppText variant="caption" muted className="mt-3">
            复评建议：{stage.assessmentSuggestion}
          </AppText>
          {onSelect ? (
            <Button
              className="mt-3"
              variant={selectedId === stage.id ? "primary" : "secondary"}
              disabled={plan.stale || !!(today && stage.endDate < today)}
              onPress={() => onSelect(stage.id)}
            >
              {selectedId === stage.id ? "已选择此阶段" : "选择此阶段生成课程"}
            </Button>
          ) : null}
        </Card>
      ))}
      <AppText variant="caption" muted>
        复评建议尚未创建测试日程；阶段安排确认后，仍需另行生成并确认具体课程。
      </AppText>
    </>
  );
}
