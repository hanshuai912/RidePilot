import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import type {
  StageReviewEvidence,
  StageReviewSnapshot,
} from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { DatePickerField } from "../../../components/ui/DatePickerField";
import { addDays } from "../../coach/model/plan-dates";
import type { useStageReviewGeneration } from "../hooks/useStageReviewGeneration";
import { decisionLabels } from "../model/goal-lifecycle";
import { GoalInfoButton } from "./GoalInfoButton";

export function StageReviewPlanner({
  current,
  evidence,
  flow: g,
  canFollow,
  dirty,
  busy,
}: {
  current: StageReviewSnapshot;
  evidence: StageReviewEvidence;
  flow: ReturnType<typeof useStageReviewGeneration>;
  canFollow: boolean;
  dirty: boolean;
  busy: boolean;
}) {
  const [adjustRoadmap, setAdjustRoadmap] = useState(false);
  const roadmap =
    evidence.decision === "EXTEND" ||
    (evidence.decision === "ADJUST" && adjustRoadmap);
  const dates =
    evidence.decision === "EXTEND" || evidence.decision === "ADJUST";
  const limit = roadmap ? 365 : 84;
  const maximumEnd = [
    current.goalTargetDate,
    addDays(g.startDate, limit - 1),
  ].sort()[0];
  const days = (Date.parse(g.endDate) - Date.parse(g.startDate)) / 86400000 + 1;
  const expiredGoal = current.goalTargetDate < current.localDate;
  const invalidDates =
    dates &&
    (!Number.isInteger(days) ||
      days < 1 ||
      days > limit ||
      g.startDate < current.localDate ||
      g.endDate > current.goalTargetDate);
  const ended = current.endDate < current.localDate;
  const unavailableStage =
    !roadmap &&
    (current.stale ||
      (evidence.decision === "KEEP" && ended) ||
      (evidence.decision === "NEXT" &&
        (!current.nextStage || current.nextStage.endDate < current.localDate)));
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="section">规划后续训练</AppText>
        <GoalInfoButton
          title="复评后规划说明"
          description="后续规划使用最近保存的复评依据，综合全部进行中目标。阶段草稿一次最多 365 天，按日期生成课程一次最多 84 天，均不得超过规划期限。生成后仍需预览、校验和确认应用。延长阶段需先确认新的阶段安排，再生成课程。"
        />
      </View>
      <Card className="gap-4 p-5">
        <AppText variant="card">{decisionLabels[evidence.decision]}</AppText>
        {!canFollow ? (
          <AppText className="text-warning">
            复评依据已变化或目标未激活，请刷新并重新复评；到期目标可先延期。
          </AppText>
        ) : null}
        {expiredGoal ? (
          <AppText className="text-warning">
            规划期限已过，请先延期目标。
          </AppText>
        ) : null}
        {dirty ? (
          <AppText variant="caption" className="text-warning">
            请先确认本次复评，再生成后续草稿。
          </AppText>
        ) : null}
        {evidence.decision === "ADJUST" ? (
          <View className="flex-row gap-2">
            {[false, true].map((value) => (
              <Button
                key={String(value)}
                className="flex-1"
                variant={adjustRoadmap === value ? "primary" : "secondary"}
                disabled={busy}
                onPress={() => setAdjustRoadmap(value)}
              >
                {value ? "阶段安排" : "课程计划"}
              </Button>
            ))}
          </View>
        ) : null}
        {dates && !expiredGoal ? (
          <View className="overflow-hidden rounded-xl border border-border bg-surface-2">
            <DatePickerField
              label="复评后开始日期"
              value={g.startDate}
              minimumDate={current.localDate}
              maximumDate={current.goalTargetDate}
              disabled={busy}
              onChange={(next) => {
                g.setStartDate(next);
                const end = [
                  current.goalTargetDate,
                  addDays(next, limit - 1),
                ].sort()[0];
                if (g.endDate < next || g.endDate > end)
                  g.setEndDate(g.endDate < next ? next : end);
              }}
            />
            <View className="mx-4 border-t border-divider" />
            <DatePickerField
              label="复评后结束日期"
              value={g.endDate}
              minimumDate={
                g.startDate < current.localDate
                  ? current.localDate
                  : g.startDate
              }
              maximumDate={maximumEnd}
              disabled={busy}
              onChange={g.setEndDate}
            />
          </View>
        ) : null}
        {invalidDates && !expiredGoal ? (
          <AppText className="text-warning">
            请选择今天起、规划期限内的 {roadmap ? "1–365" : "1–84"} 天。
          </AppText>
        ) : null}
        {ended && evidence.decision === "KEEP" ? (
          <AppText className="text-warning">
            当前阶段已结束，请重新复评并选择延长或调整。
          </AppText>
        ) : null}
        {evidence.decision === "NEXT" && !current.nextStage ? (
          <AppText className="text-warning">
            尚无下一阶段，请重新复评并调整阶段安排。
          </AppText>
        ) : null}
        {evidence.decision === "NEXT" &&
        current.nextStage &&
        current.nextStage.endDate < current.localDate ? (
          <AppText className="text-warning">
            下一阶段日期已过，请重新复评并调整阶段安排。
          </AppText>
        ) : null}
        {current.stale && !roadmap ? (
          <AppText className="text-warning">
            旧阶段不能继续生成课程，请选择调整阶段安排。
          </AppText>
        ) : null}
        <Button
          size="lg"
          loading={g.busy}
          disabled={
            busy ||
            !canFollow ||
            dirty ||
            expiredGoal ||
            invalidDates ||
            unavailableStage
          }
          onPress={() => void g.generate(roadmap)}
        >
          {roadmap
            ? "生成阶段调整草稿"
            : evidence.decision === "NEXT"
              ? "生成下一阶段课程草稿"
              : "生成后续课程草稿"}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onPress={() =>
            router.push({
              pathname: "/goals/manage",
              params: { goalId: current.goalId },
            })
          }
        >
          管理目标 / 延期
        </Button>
      </Card>
    </View>
  );
}
