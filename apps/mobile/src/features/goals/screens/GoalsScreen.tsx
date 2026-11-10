import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import { GoalListCard } from "../components/GoalListCard";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import {
  TrainingPage,
  backToTraining,
} from "../../training/components/TrainingPage";

export function GoalsScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [goals, setGoals] = useState<Awaited<
    ReturnType<typeof coachApi.goals>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      let active = true;
      if (!token) {
        setError("请先登录");
        return;
      }
      coachApi
        .goals(token)
        .then((data) => {
          if (active) {
            setGoals(data);
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "目标读取失败");
        });
      return () => {
        active = false;
      };
    }, [token, attempt]),
  );
  const primary = goals?.find(
    (goal) => goal.status === "ACTIVE" && goal.priority === "PRIMARY",
  );
  const others =
    goals?.filter(
      (goal) => goal.status !== "CLOSED" && goal.id !== primary?.id,
    ) ?? [];
  const history = goals?.filter((goal) => goal.status === "CLOSED") ?? [];
  const renderGoal = (goal: NonNullable<typeof goals>[number]) => (
    <GoalListCard
      key={goal.id}
      goal={goal}
      onOpen={() =>
        router.push({
          pathname: "/goals/[goalId]",
          params: { goalId: goal.id },
        })
      }
    />
  );
  return (
    <TrainingPage
      title="目标与阶段"
      onBack={backToTraining}
      error={error}
      retry={() => setAttempt((value) => value + 1)}
      loading={!goals && !error}
    >
      <View className="gap-6 py-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <AppText variant="section">我的目标</AppText>
          <Button
            variant={goals?.length ? "ghost" : "primary"}
            size="sm"
            onPress={() => router.push("/goals/new")}
          >
            建立新目标
          </Button>
        </View>
        {primary ? (
          <View className="gap-3">
            <AppText variant="caption" className="text-secondary">
              当前主目标
            </AppText>
            {renderGoal(primary)}
          </View>
        ) : null}
        {others.length ? (
          <View className="gap-3">
            <AppText variant="section">
              {primary ? "其他目标" : "进行中与已暂停"}
            </AppText>
            {others.map(renderGoal)}
          </View>
        ) : null}
        {history.length ? (
          <View className="gap-3">
            <AppText variant="section">历史目标</AppText>
            {history.map(renderGoal)}
          </View>
        ) : null}
        {goals && !goals.length ? (
          <Card className="gap-2 p-5">
            <AppText variant="card">还没有训练目标</AppText>
            <AppText className="text-secondary">
              建立目标后，规划训练阶段与课程。
            </AppText>
          </Card>
        ) : null}
        <View className="border-t border-divider pt-3">
          <Button
            variant="ghost"
            onPress={() => router.push("/(tabs)/coach/goal")}
          >
            首次训练建档向导
          </Button>
        </View>
      </View>
    </TrainingPage>
  );
}
