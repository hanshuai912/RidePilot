import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { AppText, Button, Disclosure } from "../../../components/ui";
import { goalTypeLabels } from "../model/goal-lifecycle";
import { goalStatusLabel, type GoalRecord } from "../model/goal-presentation";

export function GoalSwitcher({
  current,
  disabled,
  goals,
  error,
  retry,
  onSelect,
}: {
  current: GoalRecord;
  disabled: boolean;
  goals: GoalRecord[];
  error: string | null;
  retry: () => void;
  onSelect: (id: string) => void;
}) {
  const visible = goals.filter(
    (goal) => goal.status !== "CLOSED" && goal.id !== current.id,
  );
  visible.push(current);
  visible.sort((a, b) => {
    const rank = (goal: GoalRecord) =>
      goal.status === "ACTIVE" ? (goal.priority === "PRIMARY" ? 0 : 1) : 2;
    return rank(a) - rank(b);
  });
  return (
    <View className="gap-3">
      <View className="min-h-11 flex-row items-center justify-between">
        <AppText variant="card">我的目标</AppText>
        <Button
          variant="ghost"
          disabled={disabled}
          onPress={() => router.push("/goals")}
        >
          全部目标
        </Button>
      </View>
      {visible.length > 1 ? (
        <Disclosure
          title="切换查看目标"
          summary={current.description || goalTypeLabels[current.type]}
        >
          <View className="flex-row flex-wrap gap-2">
            {visible.map((goal) => {
              const selected = goal.id === current.id;
              return (
                <Pressable
                  key={goal.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`切换目标：${goal.description || goalTypeLabels[goal.type]}`}
                  accessibilityState={{ selected, checked: selected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    if (!selected) onSelect(goal.id);
                  }}
                  className={`min-h-12 w-full gap-2 border-b border-divider px-2 py-3 ${selected ? "bg-brand-subtle" : "bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
                >
                  <AppText
                    variant="caption"
                    className={selected ? "text-brand" : "text-secondary"}
                  >
                    {selected ? "正在查看 · " : ""}
                    {goal.priority === "PRIMARY" ? "主目标" : "次目标"} ·{" "}
                    {goalStatusLabel(goal)}
                  </AppText>
                  <AppText numberOfLines={2}>
                    {goal.description || goalTypeLabels[goal.type]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Disclosure>
      ) : null}
      {error ? (
        <View className="gap-2">
          <AppText variant="caption" className="text-negative">
            {error}
          </AppText>
          <Button variant="secondary" disabled={disabled} onPress={retry}>
            重试读取其他目标
          </Button>
        </View>
      ) : null}
    </View>
  );
}
