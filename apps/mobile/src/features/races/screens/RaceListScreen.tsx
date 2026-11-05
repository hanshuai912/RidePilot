import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { AppText, Badge, Button, Card, Spinner } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";

const priorityLabel = {
  A: "核心目标赛",
  B: "重要比赛",
  C: "训练型比赛",
} as const;
const statusLabel = {
  CONFIRMED: "已确认",
  CANCELLED: "已取消",
  COMPLETED: "已完成",
} as const;

export function RaceListScreen() {
  const { session } = useAuth();
  const [races, setRaces] = useState<Awaited<
    ReturnType<typeof coachApi.races>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      if (!session?.accessToken) return;
      let active = true;
      coachApi
        .races(session.accessToken)
        .then((items) => {
          if (active) {
            setRaces(items);
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "赛事读取失败");
        });
      return () => {
        active = false;
      };
    }, [session?.accessToken, attempt]),
  );
  return (
    <TrainingPage
      title="赛事管理"
      error={error}
      retry={() => setAttempt((value) => value + 1)}
    >
      {!races ? <Spinner accessibilityLabel="读取赛事" /> : null}
      {races?.map((race) => (
        <Card key={race.id}>
          <Badge variant={race.priority === "A" ? "brand" : "neutral"}>
            {priorityLabel[race.priority]}
          </Badge>
          <AppText variant="section" className="mt-3">
            {race.name}
          </AppText>
          <AppText variant="caption" muted className="mt-2">
            {race.localDate} · {race.distanceKm} km · {statusLabel[race.status]}
          </AppText>
          <AppText variant="caption" muted className="mt-1">
            {race.type === "GRAN_FONDO"
              ? "Gran Fondo"
              : race.type === "TIME_TRIAL"
                ? "计时赛"
                : race.type === "CLIMB"
                  ? "爬坡赛"
                  : "公路赛"}
          </AppText>
          <Button
            className="mt-4"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/races/[raceId]",
                params: { raceId: race.id },
              } as never)
            }
          >
            查看赛事与备赛
          </Button>
        </Card>
      ))}
      {races?.length === 0 ? (
        <Card>
          <AppText>还没有赛事，先添加一场比赛。</AppText>
        </Card>
      ) : null}
      <Button onPress={() => router.push("/races/new" as never)}>
        添加赛事
      </Button>
    </TrainingPage>
  );
}
