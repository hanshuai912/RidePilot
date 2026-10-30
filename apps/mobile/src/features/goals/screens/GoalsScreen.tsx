import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import {
  TrainingPage,
  backToTraining,
} from "../../training/components/TrainingPage";

export const goalLabels = {
  FTP: "提升 FTP",
  ENDURANCE: "提升耐力",
  CLIMBING: "提升爬坡",
  RACE: "准备比赛",
};
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
      if (!token) return;
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
  return (
    <TrainingPage
      title="训练目标"
      onBack={backToTraining}
      error={error}
      retry={() => setAttempt((value) => value + 1)}
    >
      {!goals ? (
        <Spinner accessibilityLabel="读取训练目标" />
      ) : goals.length ? (
        goals.map((goal) => (
          <Card key={goal.id}>
            <AppText variant="card">{goalLabels[goal.type]}</AppText>
            <AppText className="mt-2" muted>
              {goal.description || "围绕目标持续训练"}
            </AppText>
            <AppText variant="caption" muted className="mt-2">
              目标日期 {goal.targetDate} ·{" "}
              {goal.status === "ACTIVE"
                ? "进行中"
                : goal.status === "PAUSED"
                  ? "已暂停"
                  : "已结束"}
            </AppText>
            <Button
              className="mt-3"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/goals/[goalId]",
                  params: { goalId: goal.id },
                })
              }
            >
              查看目标与阶段
            </Button>
          </Card>
        ))
      ) : (
        <Card>
          <AppText>还没有训练目标，先到 AI 教练设置目标与训练时间。</AppText>
        </Card>
      )}
      <Button
        variant="secondary"
        onPress={() => router.push("/(tabs)/coach/goal")}
      >
        设置训练目标
      </Button>
    </TrainingPage>
  );
}
