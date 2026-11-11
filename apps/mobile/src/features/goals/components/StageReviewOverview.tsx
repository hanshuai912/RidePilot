import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { StageReviewSnapshot } from "@ridepilot/contracts";
import { AppText, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { assessmentSources } from "../../assessments/model/assessment";
import { GoalInfoButton } from "./GoalInfoButton";

export function StageReviewOverview({
  snapshot: s,
}: {
  snapshot: StageReviewSnapshot;
}) {
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <Card className="gap-4 p-5">
      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-2">
          <AppText variant="caption" className="text-secondary">
            当前阶段
          </AppText>
          <GoalInfoButton
            title="复评依据说明"
            description={
              s.notices.join("\n\n") ||
              "依据已保存的训练与测试记录复评。未记录不等于未完成，训练完成情况不代表能力进度，日期结束不代表达成。"
            }
          />
        </View>
        <AppText variant="section">{s.stageTitle}</AppText>
        <AppText variant="caption" className="tabular-nums text-secondary">
          {s.startDate} — {s.endDate}
        </AppText>
      </View>
      <View className="flex-row flex-wrap gap-3 border-t border-divider pt-4">
        {[
          [
            "已完成 / 计划",
            `${s.training.completed} / ${s.training.planned}`,
            "节",
          ],
          [
            "实际训练",
            s.training.actualMinutes === null
              ? "—"
              : String(s.training.actualMinutes),
            "分钟",
          ],
        ].map(([label, value, unit]) => (
          <View
            key={label}
            style={{ flexBasis: "44%", flexGrow: 1 }}
            className="gap-1"
          >
            <AppText variant="caption" className="text-secondary">
              {label}
            </AppText>
            <AppText variant="title" className="tabular-nums">
              {value}
              <AppText variant="caption" className="text-secondary">
                {" "}
                {unit}
              </AppText>
            </AppText>
          </View>
        ))}
      </View>
      <View className="border-t border-divider pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看训练与测试依据"
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          onPress={() => setExpanded((v) => !v)}
          className="min-h-11 flex-row items-center justify-between gap-2 py-2"
        >
          <AppText className="flex-1 text-secondary">训练与测试依据</AppText>
          <Chevron size={18} color={colors.textSecondary} />
        </Pressable>
        {expanded ? (
          <View className="gap-4 pt-3">
            <AppText variant="caption" className="text-secondary">
              统计截至 {s.localDate}
            </AppText>
            <View className="flex-row flex-wrap gap-3">
              {[
                ["部分完成", s.training.partial],
                ["跳过", s.training.skipped],
                ["未记录", s.training.unrecorded],
              ].map(([label, value]) => (
                <View key={label} className="min-w-0 flex-1 gap-1">
                  <AppText variant="caption" className="text-secondary">
                    {label}
                  </AppText>
                  <AppText className="tabular-nums">{value} 节</AppText>
                </View>
              ))}
            </View>
            <AppText variant="card">阶段测试 · {s.tests.length} 次</AppText>
            {s.tests.length ? (
              s.tests.map((test) => (
                <View
                  key={test.id}
                  className="gap-2 border-t border-divider pt-3"
                >
                  <AppText variant="caption" className="text-secondary">
                    {test.date} · {test.valid ? "有效记录" : "非有效实测"}
                  </AppText>
                  <AppText>{test.protocol}</AppText>
                  {test.watts !== null || test.seconds !== null ? (
                    <AppText className="tabular-nums">
                      {[
                        test.watts !== null ? `${test.watts} W` : null,
                        test.seconds !== null ? `${test.seconds} 秒` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" className="text-secondary">
                    来源：
                    {assessmentSources[
                      test.source as keyof typeof assessmentSources
                    ] ??
                      test.source ??
                      "未记录"}
                  </AppText>
                </View>
              ))
            ) : (
              <AppText className="text-secondary">暂无阶段测试记录</AppText>
            )}
          </View>
        ) : null}
      </View>
      {s.stale ? (
        <AppText className="text-warning">
          阶段依据已变化，后续需重新规划阶段。
        </AppText>
      ) : null}
      {s.goalStatus !== "ACTIVE" ? (
        <AppText className="text-warning">
          关联目标未激活，暂不能生成后续安排。
        </AppText>
      ) : null}
    </Card>
  );
}
