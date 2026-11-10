import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AppText, Button } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { goalTypeLabels } from "../model/goal-lifecycle";
import { goalStatusLabel, type GoalRecord } from "../model/goal-presentation";

export function GoalSwitcher({
  current,
  disabled,
}: {
  current: GoalRecord;
  disabled: boolean;
}) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      let active = true;
      if (token)
        coachApi
          .goals(token)
          .then((value) => {
            if (active) {
              setGoals(value);
              setError(null);
            }
          })
          .catch(() => {
            if (active) setError("其他目标读取失败");
          });
      return () => {
        active = false;
      };
    }, [token, attempt]),
  );
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
        <View className="flex-row flex-wrap gap-2">
          {visible.map((goal) => {
            const selected = goal.id === current.id;
            return (
              <Pressable
                key={goal.id}
                accessibilityRole="button"
                accessibilityLabel={`切换目标：${goal.description || goalTypeLabels[goal.type]}`}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => {
                  if (!selected)
                    router.replace({
                      pathname: "/goals/[goalId]",
                      params: { goalId: goal.id },
                    });
                }}
                style={{ flexBasis: "45%", flexGrow: 1 }}
                className={`min-h-[76px] gap-2 rounded-xl border p-3 ${selected ? "border-brand-subtle bg-brand-subtle" : "border-border bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
              >
                <AppText
                  variant="caption"
                  className={selected ? "text-brand" : "text-secondary"}
                >
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
      ) : null}
      {error ? (
        <View className="gap-2">
          <AppText variant="caption" className="text-negative">
            {error}
          </AppText>
          <Button
            variant="secondary"
            disabled={disabled}
            onPress={() => setAttempt((value) => value + 1)}
          >
            重试读取其他目标
          </Button>
        </View>
      ) : null}
    </View>
  );
}
