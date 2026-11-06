import type { GoalChangePreview, GoalInput } from "@ridepilot/contracts";
import { AppText } from "../../../components/ui";
import { goalTypeLabels } from "../model/goal-lifecycle";

function GoalValues({ goal }: { goal: GoalInput }) {
  return (
    <>
      <AppText className="mt-2">
        {goalTypeLabels[goal.type]} ·{" "}
        {goal.priority === "PRIMARY" ? "主目标" : "次目标"} · {goal.targetDate}
      </AppText>
      <AppText muted className="mt-2">
        说明：{goal.description || "未填写"}
      </AppText>
      <AppText className="mt-2">
        达成条件：{goal.successCriteria || "待补充"}
      </AppText>
      {goal.type === "FTP" ? (
        <AppText muted className="mt-2">
          目标 FTP {goal.targetFtpWatts ?? "未设定"} W · 功体比{" "}
          {goal.targetWkg ?? "未设定"} W/kg
        </AppText>
      ) : null}
    </>
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
  return (
    <>
      <AppText variant="card" className="mt-3">
        原目标
      </AppText>
      <GoalValues goal={comparison.before} />
      <AppText variant="card" className="mt-3">
        {comparison.nextGoal ? "下一目标" : "确认后"}
      </AppText>
      <GoalValues goal={comparison.nextGoal ?? comparison.after} />
      <AppText className="mt-2">
        原目标状态：{status[comparison.before.status]} →{" "}
        {comparison.after.closureReason === "COMPLETED"
          ? "用户确认完成"
          : status[comparison.after.status]}
      </AppText>
      <AppText className="mt-2">操作理由：{reason}</AppText>
      <AppText className="mt-2">
        需检查：未来课程 {comparison.affected.workouts.length} 节、测试{" "}
        {comparison.affected.assessments.length} 项、阶段{" "}
        {comparison.affected.stages.length} 项
      </AppText>
      {comparison.affected.workouts.map((w) => (
        <AppText key={w.id} muted className="mt-2">
          保留 {w.date} · {w.title}
        </AppText>
      ))}
      {comparison.affected.assessments.map((a) => (
        <AppText key={a.id} muted className="mt-2">
          测试保留 {a.date} · {a.title}
        </AppText>
      ))}
      {comparison.affected.stages.map((s) => (
        <AppText key={s.id} muted className="mt-2">
          需重新核对阶段：{s.title}
        </AppText>
      ))}
      {comparison.affected.otherPrimaryGoals.map((g) => (
        <AppText key={g.id} className="mt-2 text-warning">
          {g.description || goalTypeLabels[g.type]}：主目标 → 次目标
        </AppText>
      ))}
    </>
  );
}
