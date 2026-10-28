import { Pressable, View } from "react-native";

import { AppText, Card, Input } from "../../../components/ui";
import type { CoachTask, PlanningScope } from "../hooks/useInitialPlan";
import type { CoachPlanStatus } from "../services/coach.api";
import { ChoicePill, InfoStrip } from "./CoachPage";

const taskCopy: Record<
  CoachTask,
  { eyebrow: string; title: string; description: string; primary: string }
> = {
  REPLAN: {
    eyebrow: "重新规划",
    title: "告诉我接下来要怎么变",
    description:
      "调整目标、日期或近期训练重点，AI 会保留已完成记录并重新整理未来草稿。",
    primary: "生成重规划草稿",
  },
  RECOVERY: {
    eyebrow: "赛后恢复",
    title: "先恢复，再回到训练节奏",
    description:
      "告诉我最近完成的比赛和身体状态，AI 会先安排恢复周，再衔接正式训练。",
    primary: "生成恢复建议",
  },
  RACE: {
    eyebrow: "准备比赛",
    title: "围绕比赛安排训练",
    description: "输入比赛日期和目标，AI 会把备赛重点加入下一份训练草稿。",
    primary: "生成备赛草稿",
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
              accessibilityState={{ selected: planningScope === option.value }}
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
                  {option.note}
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
        <InfoStrip>
          当前接口会先生成一周训练草稿；选择整周期或下一节时，AI
          会把你的上下文带入草稿说明。
        </InfoStrip>
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
        {task === "REPLAN" ? (
          <Pressable
            accessibilityRole="button"
            className="mt-3 rounded-xl border border-border bg-surface-2 px-3 py-3"
            onPress={onEditGoal}
          >
            <AppText className="text-brand">修改当前目标与日期 →</AppText>
          </Pressable>
        ) : null}
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
          {task === "RACE" ? "比赛信息" : "补充说明"}
        </AppText>
        <AppText variant="caption" muted className="mt-1">
          {task === "RACE"
            ? "比赛信息会作为本次备赛草稿的上下文。"
            : "告诉 AI 最近发生的变化，生成结果会更贴近你的实际状态。"}
        </AppText>
        <Input
          className="mt-3 min-h-[92px] py-3"
          accessibilityLabel={task === "RACE" ? "比赛信息" : "训练调整说明"}
          multiline
          textAlignVertical="top"
          value={taskNote}
          onChangeText={setTaskNote}
          maxLength={240}
          placeholder={
            task === "RECOVERY"
              ? "例如：上周完成半马，腿部还有些酸，希望这周先恢复，下周开始正式训练"
              : task === "RACE"
                ? "例如：12 月 15 日有一场 100 km 骑行，希望稳妥完赛"
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
