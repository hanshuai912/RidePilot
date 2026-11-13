import { Pressable, View } from "react-native";
import { NavigationHeaderAction } from "../../../components/layout/NavigationHeaderAction";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  AppText,
  Badge,
  Card,
  Spinner,
  Disclosure,
} from "../../../components/ui";
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
      headerAction={
        <NavigationHeaderAction
          label="添加赛事"
          onPress={() => router.push("/races/new")}
        />
      }
      error={error}
      retry={() => setAttempt((value) => value + 1)}
    >
      {!races ? <Spinner accessibilityLabel="读取赛事" /> : null}
      {(["CONFIRMED", "COMPLETED", "CANCELLED"] as const).map((status) => {
        const items =
          races
            ?.filter((race) => race.status === status)
            .sort((a, b) =>
              status === "CONFIRMED"
                ? a.localDate.localeCompare(b.localDate)
                : b.localDate.localeCompare(a.localDate),
            ) ?? [];
        if (!items.length) return null;
        const rows = (
          <Card padding="none">
            {items.map((race) => (
              <Pressable
                key={race.id}
                accessibilityRole="button"
                accessibilityLabel={`查看赛事与备赛：${race.name}`}
                onPress={() =>
                  router.push({
                    pathname: "/races/[raceId]",
                    params: { raceId: race.id },
                  })
                }
                className="min-h-12 gap-2 border-b border-divider p-4 active:opacity-70"
              >
                <View className="flex-row flex-wrap items-center gap-2">
                  <Badge variant={race.priority === "A" ? "brand" : "neutral"}>
                    {priorityLabel[race.priority]}
                  </Badge>
                  <AppText variant="caption" muted>
                    {race.localDate}
                  </AppText>
                </View>
                <AppText variant="card">{race.name}</AppText>
                <AppText variant="caption" muted>
                  {race.distanceKm} km · {statusLabel[race.status]} ·{" "}
                  {race.type === "GRAN_FONDO"
                    ? "Gran Fondo"
                    : race.type === "TIME_TRIAL"
                      ? "计时赛"
                      : race.type === "CLIMB"
                        ? "爬坡赛"
                        : race.type === "OTHER"
                          ? "其他"
                          : "公路赛"}
                </AppText>
              </Pressable>
            ))}
          </Card>
        );
        return status === "CANCELLED" ? (
          <Disclosure
            key={status}
            title="已取消赛事"
            summary={`${items.length} 场`}
          >
            {rows}
          </Disclosure>
        ) : (
          <View key={status} className="gap-3">
            <AppText variant="section">
              {status === "CONFIRMED" ? "待完成赛事" : "已完成赛事"} ·{" "}
              {items.length}
            </AppText>
            {rows}
          </View>
        );
      })}
      {races?.length === 0 ? (
        <Card>
          <AppText>还没有赛事，先添加一场比赛。</AppText>
        </Card>
      ) : null}
    </TrainingPage>
  );
}
