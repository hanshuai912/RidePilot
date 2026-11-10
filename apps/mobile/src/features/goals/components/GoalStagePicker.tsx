import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
import type { StagePlanResponse } from "@ridepilot/contracts";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { goalDateLabel } from "../model/goal-presentation";

export function GoalStagePicker({
  plan,
  selectedId,
  today,
  disabled,
  onSelect,
}: {
  plan: StagePlanResponse | null;
  selectedId: string;
  today: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(!selectedId);
  const selected = plan?.stages.find((stage) => stage.id === selectedId);
  if (!plan?.stages.length)
    return (
      <AppText className="text-secondary">
        暂无阶段安排，可按日期规划课程。
      </AppText>
    );
  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="选择训练阶段"
        accessibilityState={{ expanded, disabled }}
        disabled={disabled}
        onPress={() => setExpanded((value) => !value)}
        className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 active:bg-elevated"
      >
        <View className="min-w-0 flex-1 gap-1">
          <AppText>{selected?.title ?? "选择训练阶段"}</AppText>
          {selected ? (
            <AppText variant="caption" className="tabular-nums text-secondary">
              {goalDateLabel(selected.startDate)} —{" "}
              {goalDateLabel(selected.endDate)}
            </AppText>
          ) : null}
        </View>
        {expanded ? (
          <ChevronUp color={colors.textSecondary} size={18} />
        ) : (
          <ChevronDown color={colors.textSecondary} size={18} />
        )}
      </Pressable>
      {expanded ? (
        <View className="overflow-hidden rounded-xl border border-border">
          {plan.stages.map((stage, index) => {
            const ended = stage.endDate < today;
            const blocked = disabled || plan.stale || ended;
            const checked = stage.id === selectedId;
            return (
              <Pressable
                key={stage.id}
                accessibilityRole="radio"
                accessibilityLabel={`选择阶段：${stage.title}`}
                accessibilityState={{
                  checked,
                  selected: checked,
                  disabled: blocked,
                }}
                disabled={blocked}
                onPress={() => {
                  onSelect(stage.id);
                  setExpanded(false);
                }}
                className={`min-h-[64px] flex-row items-center gap-3 p-3 ${index ? "border-t border-divider" : ""} ${checked ? "bg-brand-subtle" : "bg-surface"} ${blocked ? "opacity-50" : "active:bg-surface-2"}`}
              >
                <View className="min-w-0 flex-1 gap-1">
                  <AppText className={checked ? "text-brand" : "text-primary"}>
                    {stage.title}
                  </AppText>
                  <AppText
                    variant="caption"
                    className="tabular-nums text-secondary"
                  >
                    {goalDateLabel(stage.startDate)} —{" "}
                    {goalDateLabel(stage.endDate)}
                  </AppText>
                  <AppText variant="label" className="text-secondary">
                    {ended
                      ? "日期已结束"
                      : stage.startDate <= today
                        ? "当前阶段"
                        : "后续阶段"}
                  </AppText>
                </View>
                {checked ? <Check color={colors.brand} size={18} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {plan.stale ? (
        <AppText variant="caption" className="text-warning">
          阶段安排已失效，请按日期规划或重新生成阶段。
        </AppText>
      ) : selected && selected.endDate < today ? (
        <AppText variant="caption" className="text-warning">
          所选阶段日期已结束，请选择后续阶段。
        </AppText>
      ) : null}
    </View>
  );
}
