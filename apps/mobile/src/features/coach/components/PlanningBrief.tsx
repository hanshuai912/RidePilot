import type { CoachTask, PlanningScope } from "../hooks/useInitialPlan";
import type { CoachPlanStatus } from "../services/coach.api";
import { ReplanBrief } from "./ReplanBrief";
import { RecoveryBrief } from "./RecoveryBrief";

const taskCopy: Record<CoachTask, { eyebrow: string; primary: string }> = {
  REPLAN: {
    eyebrow: "调整训练",
    primary: "生成训练调整草稿",
  },
  RECOVERY: {
    eyebrow: "赛后恢复",
    primary: "生成恢复草稿",
  },
};

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
  busy = false,
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
  busy?: boolean;
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
  return (
    <RecoveryBrief
      planningScope={planningScope}
      setPlanningScope={setPlanningScope}
      taskNote={taskNote}
      setTaskNote={setTaskNote}
      bodyStatus={bodyStatus}
      setBodyStatus={setBodyStatus}
      planStatus={planStatus}
      goalLabel={goalLabel}
      goalDate={goalDate}
      busy={busy}
    />
  );
}

export function planningTaskCopy(task: CoachTask) {
  return taskCopy[task];
}
