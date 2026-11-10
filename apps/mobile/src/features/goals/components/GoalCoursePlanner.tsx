import { Pressable, View } from "react-native";
import { AppText, Button, Card, Input } from "../../../components/ui";
import type { useGoalPlanning } from "../hooks/useGoalPlanning";
import { GoalStagePicker } from "./GoalStagePicker";
import { GoalPlanningDates } from "./GoalPlanningDates";

type PlanningFlow = ReturnType<typeof useGoalPlanning>;

function PlannerDates({
  flow,
  onEdit,
}: {
  flow: PlanningFlow;
  onEdit: () => void;
}) {
  return (
    <GoalPlanningDates
      startDate={flow.startDate}
      endDate={flow.endDate}
      today={flow.data?.today ?? flow.startDate}
      disabled={flow.busy}
      onChange={(start, end) => {
        onEdit();
        flow.setStartDate(start);
        flow.setEndDate(end);
      }}
    />
  );
}

export function GoalCoursePlanner({
  flow,
  onEdit,
}: {
  flow: PlanningFlow;
  onEdit: () => void;
}) {
  const stage = flow.data?.stages?.stages.find(
    (item) => item.id === flow.stageId,
  );
  const validStage =
    !!stage &&
    !flow.data?.stages?.stale &&
    stage.endDate >= (flow.data?.today ?? "");
  const days =
    (Date.parse(flow.endDate) - Date.parse(flow.startDate)) / 86400000 + 1;
  const validDates =
    days >= 1 && days <= 84 && flow.startDate >= (flow.data?.today ?? "");
  const canGenerate = flow.scope === "STAGE" ? validStage : validDates;
  return (
    <View className="gap-4" testID="goal-course-planner">
      <AppText variant="section">规划后续训练</AppText>
      <Card className="gap-4 p-5">
        <View className="flex-row flex-wrap gap-1 rounded-xl bg-background p-1">
          {(["DATES", "STAGE"] as const).map((scope) => (
            <Pressable
              key={scope}
              accessibilityRole="radio"
              accessibilityLabel={scope === "DATES" ? "日期范围" : "所选阶段"}
              accessibilityState={{
                selected: flow.scope === scope,
                checked: flow.scope === scope,
                disabled: flow.busy,
              }}
              disabled={flow.busy}
              onPress={() => {
                onEdit();
                flow.setScope(scope);
              }}
              className={`min-h-11 flex-1 items-center justify-center rounded-lg px-3 py-3 ${flow.scope === scope ? "bg-brand-subtle" : "active:bg-surface-2"}`}
            >
              <AppText
                className={
                  flow.scope === scope ? "text-brand" : "text-secondary"
                }
              >
                {scope === "DATES" ? "日期范围" : "所选阶段"}
              </AppText>
            </Pressable>
          ))}
        </View>
        {flow.scope === "DATES" ? (
          <PlannerDates flow={flow} onEdit={onEdit} />
        ) : (
          <GoalStagePicker
            plan={flow.data?.stages ?? null}
            selectedId={flow.stageId}
            today={flow.data?.today ?? ""}
            disabled={flow.busy}
            onSelect={(id) => {
              onEdit();
              flow.setStageId(id);
            }}
          />
        )}
        <View className="gap-2">
          <AppText variant="caption" className="text-secondary">
            课程补充要求（选填）
          </AppText>
          <Input
            accessibilityLabel="课程补充要求"
            value={flow.notes}
            placeholder="如：减少长距离训练、保留休息日"
            editable={!flow.busy}
            onChangeText={(value) => {
              onEdit();
              flow.setNotes(value);
            }}
            maxLength={200}
            multiline
          />
        </View>
        {flow.scope === "DATES" && !validDates ? (
          <AppText variant="caption" className="text-warning">
            课程每次可规划 1–84 天，请调整日期范围。
          </AppText>
        ) : null}
        <Button
          size="lg"
          disabled={flow.busy || !canGenerate}
          onPress={() => void flow.generate("COURSES")}
        >
          生成课程草稿
        </Button>
        <AppText variant="caption" className="text-secondary">
          草稿预览并确认后生效
        </AppText>
      </Card>
    </View>
  );
}
