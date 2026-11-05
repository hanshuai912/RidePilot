import type { coachApi } from "../../coach/services/coach.api";
import { AppText, Card } from "../../../components/ui";

export function RaceImpactCard({
  impact,
}: {
  impact: Awaited<ReturnType<typeof coachApi.raceImpact>>;
}) {
  return (
    <Card>
      <AppText variant="card">所选范围的影响</AppText>
      <AppText muted className="mt-2">
        {impact.startDate} 至 {impact.endDate}
      </AppText>
      {impact.workouts?.map((item) => (
        <AppText key={item.id} className="mt-2">
          {item.date} · {item.title} · {item.retained ? "保留记录" : "待调整"}
        </AppText>
      ))}
      {impact.workouts?.length === 0 ? (
        <AppText muted className="mt-2">
          该范围暂无课程，可直接生成训练草稿。
        </AppText>
      ) : null}
      {impact.conflicts.map((item, i) => (
        <AppText key={`${item.kind}-${i}`} className="mt-2 text-warning">
          {item.date} · {item.title}
        </AppText>
      ))}
      {impact.stages?.map((item) => (
        <AppText key={item.id} className="mt-2">
          相关阶段：{item.title}（{item.startDate} 至 {item.endDate}）
        </AppText>
      ))}
      {impact.messages?.map((message) => (
        <AppText key={message} variant="caption" muted className="mt-2">
          {message}
        </AppText>
      ))}
    </Card>
  );
}
