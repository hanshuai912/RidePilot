import type { GoalEvaluation as Evaluation } from "@ridepilot/contracts";
import { AppText, Card } from "../../../components/ui";

export function GoalEvaluation({ data }: { data: Evaluation }) {
  return (
    <Card>
      <AppText variant="card">目标差距与不确定性</AppText>
      <AppText className="mt-2">
        {data.daysRemaining < 0
          ? `已到期 ${-data.daysRemaining} 天`
          : `剩余 ${data.daysRemaining} 天`}{" "}
        · 每周可训练 {data.weeklyMinutes ?? "未填写"} 分钟
      </AppText>
      {data.currentFtp ? (
        <AppText muted className="mt-2">
          当前 FTP {data.currentFtp.valueWatts} W ·{" "}
          {data.currentFtp.measuredAt.slice(0, 10)} ·{" "}
          {data.currentFtp.source === "TEST" ? "测试结果" : "手动填写"}
        </AppText>
      ) : null}
      {data.wattsGap !== null ? (
        <AppText className="mt-2">FTP 数值差距 {data.wattsGap} W</AppText>
      ) : null}
      {data.wkgGap !== null ? (
        <AppText className="mt-2">功体比数值差距 {data.wkgGap} W/kg</AppText>
      ) : null}
      {data.notices.map((text) => (
        <AppText key={text} variant="caption" muted className="mt-2">
          {text}
        </AppText>
      ))}
    </Card>
  );
}
