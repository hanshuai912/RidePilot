import { View } from "react-native";
import type { GoalEvaluation as Evaluation } from "@ridepilot/contracts";
import { AppText, Badge, Card } from "../../../components/ui";
import { goalTypeLabels } from "../model/goal-lifecycle";
import { goalStatusLabel, type GoalRecord } from "../model/goal-presentation";
import { GoalInfoButton } from "./GoalInfoButton";

export function GoalEvaluation({
  data,
  goal,
  compact = false,
}: {
  data: Evaluation;
  goal?: GoalRecord;
  compact?: boolean;
}) {
  const source = data.currentFtp
    ? `当前 FTP ${data.currentFtp.valueWatts} W，测量日期 ${data.currentFtp.measuredAt.slice(0, 10)}，${data.currentFtp.source === "TEST" ? "来自测试结果" : data.currentFtp.source === "MANUAL" ? "来自手动填写" : "来源：" + data.currentFtp.source}。`
    : "尚未填写 FTP 基线。";
  const metrics = [
    {
      label: data.daysRemaining < 0 ? "已到期" : "剩余时间",
      value: `${Math.abs(data.daysRemaining)} 天`,
      warning: data.daysRemaining < 0,
    },
    {
      label: "当前 FTP",
      value: data.currentFtp ? `${data.currentFtp.valueWatts} W` : "未填写",
    },
    {
      label: "每周可训练",
      value:
        data.weeklyMinutes === null ? "未填写" : `${data.weeklyMinutes} 分钟`,
    },
    ...(data.wattsGap !== null
      ? [{ label: "FTP 数值差距", value: `${data.wattsGap} W` }]
      : []),
    ...(data.wkgGap !== null
      ? [{ label: "功体比数值差距", value: `${data.wkgGap} W/kg` }]
      : []),
  ];
  return (
    <Card className="gap-4 p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="min-w-0 flex-row items-center">
          <AppText variant="card">
            {goal ? goalTypeLabels[goal.type] : "目标评估"}
          </AppText>
          {compact ? (
            <GoalInfoButton
              title="评估说明"
              description={[source, ...data.notices].join("\n\n")}
            />
          ) : null}
        </View>
        {goal ? (
          <Badge variant={goal.status === "ACTIVE" ? "brand" : "neutral"}>
            {goal.priority === "PRIMARY" ? "主目标" : "次目标"} ·{" "}
            {goalStatusLabel(goal)}
          </Badge>
        ) : null}
      </View>
      {goal?.description && goal.description !== goalTypeLabels[goal.type] ? (
        <AppText className="text-secondary">{goal.description}</AppText>
      ) : null}
      <View className="flex-row flex-wrap gap-x-4 gap-y-4">
        {metrics.map((metric) => (
          <View
            key={metric.label}
            style={{ flexBasis: "43%", flexGrow: 1 }}
            className="gap-1"
          >
            <AppText variant="caption" className="text-secondary">
              {metric.label}
            </AppText>
            <AppText
              variant="card"
              className={`tabular-nums ${metric.warning ? "text-warning" : ""}`}
            >
              {metric.value}
            </AppText>
          </View>
        ))}
      </View>
      {!compact ? (
        <View className="gap-3 border-t border-divider pt-3">
          {data.currentFtp ? (
            <AppText variant="caption" className="text-secondary">
              {source}
            </AppText>
          ) : null}
          {data.notices.map((text) => (
            <AppText key={text} variant="caption" className="text-secondary">
              {text}
            </AppText>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
