import { Pressable, View } from "react-native";
import type { AiProposalResponse } from "@ridepilot/contracts";

import { AppText } from "../../../components/ui";

function totalMinutes(proposal: AiProposalResponse) {
  return proposal.workouts.reduce(
    (total, workout) =>
      total +
      workout.segments.reduce(
        (segmentTotal, segment) =>
          segmentTotal +
          (segment.target.unit === "min" ? segment.target.value : 0),
        0,
      ),
    0,
  );
}

export function PlanCandidates({
  proposal,
  selected,
  onSelect,
}: {
  proposal: AiProposalResponse;
  selected: boolean;
  onSelect: () => void;
}) {
  const minutes = totalMinutes(proposal);

  return (
    <>
      <View className="rounded-[18px] border border-border border-l-4 border-l-brand bg-surface p-4">
        <AppText variant="label" className="text-brand">
          根据你的信息生成
        </AppText>
        <AppText variant="section" className="mt-2">
          {proposal.summary}
        </AppText>
        <AppText variant="caption" className="mt-2 text-secondary">
          先选择推荐草稿，再查看训练日期、训练量和限制影响。
        </AppText>
        <View className="mt-4 flex-row gap-2">
          <View className="flex-1 rounded-xl bg-surface-2 p-3">
            <AppText variant="label" muted>
              训练日
            </AppText>
            <AppText variant="card" className="mt-1 text-brand">
              {proposal.workouts.length} 天
            </AppText>
          </View>
          <View className="flex-1 rounded-xl bg-surface-2 p-3">
            <AppText variant="label" muted>
              周期总量
            </AppText>
            <AppText variant="card" className="mt-1 text-brand">
              {minutes || "—"} {minutes ? "分钟" : ""}
            </AppText>
          </View>
        </View>
      </View>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        className={`rounded-[18px] border p-4 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"}`}
        onPress={onSelect}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <AppText variant="card">
                <AppText className={selected ? "text-brand" : "text-muted"}>
                  {selected ? "◉" : "○"}
                </AppText>{" "}
                推荐训练草稿
              </AppText>
            </View>
            <AppText variant="caption" muted className="mt-2">
              {proposal.stageSummary}
            </AppText>
          </View>
          <AppText variant="label" className="text-brand">
            {selected ? "已选择" : "选择"}
          </AppText>
        </View>
        <View className="mt-4 flex-row flex-wrap gap-2">
          <View className="rounded-full border border-positive/40 bg-surface-2 px-2.5 py-1">
            <AppText variant="label" className="text-positive">
              保留恢复空间
            </AppText>
          </View>
          <View className="rounded-full border border-border bg-surface-2 px-2.5 py-1">
            <AppText variant="label" muted>
              草稿 · 尚未应用
            </AppText>
          </View>
        </View>
      </Pressable>
      <View className="rounded-[18px] border border-dashed border-border bg-surface p-4 opacity-70">
        <View className="flex-row items-center justify-between">
          <AppText variant="card" className="text-secondary">
            更多训练方向
          </AppText>
          <AppText variant="label" muted>
            后续开放
          </AppText>
        </View>
        <AppText variant="caption" muted className="mt-2">
          当前接口只返回一份真实推荐草稿，暂不生成未经校验的第二套方案。
        </AppText>
      </View>
      <View className="flex-row gap-2 rounded-[14px] border border-warning/50 bg-surface-2 p-3">
        <AppText className="text-warning">△</AppText>
        <AppText variant="caption" className="flex-1 text-secondary">
          当前服务端返回一份推荐草稿。确认前不会覆盖正式计划，饮食信息也不会提交。
        </AppText>
      </View>
    </>
  );
}
