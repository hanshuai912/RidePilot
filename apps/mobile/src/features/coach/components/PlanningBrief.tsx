import { Pressable, View } from "react-native";

import { AppText, Card, Input } from "../../../components/ui";
import type { CoachTask, PlanningScope } from "../hooks/useInitialPlan";
import type { CoachPlanStatus } from "../services/coach.api";
import { ReplanBrief } from "./ReplanBrief";
import { ChoicePill } from "./CoachPage";

const taskCopy: Record<
  CoachTask,
  { eyebrow: string; title: string; description: string; primary: string }
> = {
  REPLAN: {
    eyebrow: "调整训练",
    title: "让训练适应最近的变化",
    description:
      "调整目标、日期或近期训练重点，AI 会保留已完成记录并重新整理未来草稿。",
    primary: "生成训练调整草稿",
  },
  RECOVERY: {
    eyebrow: "赛后恢复",
    title: "先恢复，再回到训练节奏",
    description:
      "告诉我最近完成的比赛和身体状态，AI 会先安排恢复周，再衔接正式训练。",
    primary: "生成恢复建议",
  },
};

const scopeOptions: { value: PlanningScope; label: string; note: string }[] = [
  { value: "NEXT_WORKOUT", label: "下一节训练", note: "只调整最近一节" },
  { value: "THIS_WEEK", label: "本周剩余训练", note: "保留已完成课程" },
  { value: "NEXT_WEEK", label: "从下周开始", note: "生成下一周草稿" },
  { value: "CYCLE", label: "整个训练周期", note: "重新安排未来阶段" },
];

export function PlanningBrief({
  task,
  planningScope,
  setPlanningScope,
  taskNote,
  setTaskNote,
  bodyStatus,
  setBodyStatus,
  planStatus,
  goalLabel,
  goalDate,
  onEditGoal,
}: {
  task: CoachTask;
  planningScope: PlanningScope;
  setPlanningScope: (value: PlanningScope) => void;
  taskNote: string;
  setTaskNote: (value: string) => void;
  bodyStatus: "READY" | "TIRED" | "RECOVERY";
  setBodyStatus: (value: "READY" | "TIRED" | "RECOVERY") => void;
  planStatus: CoachPlanStatus;
  goalLabel: string;
  goalDate: string;
  onEditGoal: () => void;
}) {
  if (task === "REPLAN")
    return (
      <ReplanBrief
        planningScope={planningScope}
        setPlanningScope={setPlanningScope}
        taskNote={taskNote}
        setTaskNote={setTaskNote}
        planStatus={planStatus}
        goalLabel={goalLabel}
        goalDate={goalDate}
        onEditGoal={onEditGoal}
      />
    );
  const copy = taskCopy[task];
  return (
    <>
      <View className="overflow-hidden rounded-[19px] border border-border bg-surface p-4">
        <AppText variant="label" className="text-brand">
          {copy.eyebrow}
        </AppText>
        <AppText variant="display" className="mt-2 text-[27px] leading-[32px]">
          {copy.title}
        </AppText>
        <AppText variant="body" className="mt-2 text-secondary">
          {copy.description}
        </AppText>
      </View>

      <Card>
        <AppText variant="label" className="text-muted">
          影响范围
        </AppText>
        <AppText variant="card" className="mt-2">
          这次希望 AI 调整到哪里？
        </AppText>
        <View className="mt-4 gap-2">
          {scopeOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{
                selected: planningScope === option.value,
                disabled: option.value === "CYCLE",
              }}
              disabled={option.value === "CYCLE"}
              className={`flex-row items-center justify-between rounded-xl border px-3 py-3 ${planningScope === option.value ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
              onPress={() => setPlanningScope(option.value)}
            >
              <View>
                <AppText
                  className={
                    planningScope === option.value ? "text-brand" : undefined
                  }
                >
                  {option.label}
                </AppText>
                <AppText variant="caption" muted className="mt-1">
                  {option.value === "CYCLE"
                    ? "暂未开放，请选择下一节或按周调整"
                    : option.note}
                </AppText>
              </View>
              <AppText
                className={
                  planningScope === option.value ? "text-brand" : "text-muted"
                }
              >
                {planningScope === option.value ? "✓" : "○"}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <AppText variant="label" className="text-muted">
          AI 已经知道
        </AppText>
        <View className="mt-3 gap-2 rounded-xl bg-surface-2 px-3">
          <ContextRow label="当前目标" value={`${goalLabel} · ${goalDate}`} />
          <ContextRow label="正式计划" value={`v${planStatus.planVersion}`} />
          <ContextRow label="历史记录" value="已完成训练会保留" last />
        </View>
      </Card>

      {task === "RECOVERY" ? (
        <Card>
          <AppText variant="label" className="text-muted">
            当前身体状态
          </AppText>
          <View className="mt-3 gap-2">
            <ChoicePill
              label="正常，可以开始训练"
              selected={bodyStatus === "READY"}
              onPress={() => setBodyStatus("READY")}
            />
            <ChoicePill
              label="疲劳，需要降低训练压力"
              selected={bodyStatus === "TIRED"}
              onPress={() => setBodyStatus("TIRED")}
            />
            <ChoicePill
              label="比赛后恢复中"
              selected={bodyStatus === "RECOVERY"}
              onPress={() => setBodyStatus("RECOVERY")}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <AppText variant="label" className="text-muted">
          补充说明
        </AppText>
        <AppText variant="caption" muted className="mt-1">
          告诉 AI 最近发生的变化，生成结果会更贴近你的实际状态。
        </AppText>
        <Input
          className="mt-3 min-h-[92px] py-3"
          accessibilityLabel="训练调整说明"
          multiline
          textAlignVertical="top"
          value={taskNote}
          onChangeText={setTaskNote}
          maxLength={240}
          placeholder={
            task === "RECOVERY"
              ? "例如：上周完成半马，腿部还有些酸，希望这周先恢复，下周开始正式训练"
              : "例如：最近工作变忙，目标日期想延后两周"
          }
        />
      </Card>
    </>
  );
}

function ContextRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-3 ${last ? "" : "border-b border-divider"}`}
    >
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="caption" className="max-w-[65%] text-right">
        {value}
      </AppText>
    </View>
  );
}

export function planningTaskCopy(task: CoachTask) {
  return taskCopy[task];
}
