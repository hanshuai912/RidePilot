import type { PlanImpactItem } from "@ridepilot/contracts";
import { AppText, Card } from "../../../components/ui";

export function ImpactWorkoutCard({
  item,
  comparison = true,
}: {
  item: PlanImpactItem;
  comparison?: boolean;
}) {
  const w = item.workout;
  return (
    <Card>
      <AppText variant="card">
        {w.scheduledDate} · {w.title || "骑行训练"}
      </AppText>
      <AppText muted className="mt-2">
        {w.timeTargetMinutes !== null
          ? `${w.timeTargetMinutes} 分钟`
          : "时长未确定"}
        {w.distanceTargetKm ? ` · ${w.distanceTargetKm} 公里` : ""} ·{" "}
        {w.purpose || "未填写训练目的"}
      </AppText>
      {item.messages.map((m) => (
        <AppText key={m} variant="caption" className="mt-2 text-warning">
          {m}
        </AppText>
      ))}
      {item.power.map((p, index) => (
        <AppText key={index} variant="caption" muted className="mt-2">
          动作 {index + 1} ·{" "}
          {comparison ? `原 ${p.before}\n重算后 ${p.after}` : p.before}
        </AppText>
      ))}
    </Card>
  );
}
