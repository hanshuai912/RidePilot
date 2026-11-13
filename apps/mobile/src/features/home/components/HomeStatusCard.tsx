import { View } from "react-native";
import { router } from "expo-router";
import type { HomeActions } from "@ridepilot/contracts";
import {
  AppText,
  Button,
  Card,
  Spinner,
  Disclosure,
} from "../../../components/ui";
import type { HomeResource } from "../hooks/useHomeData";
import { HomeResourceFeedback } from "./HomeResourceFeedback";

export function HomeStatusCard({
  resource,
  onRetry,
}: {
  resource: HomeResource<HomeActions>;
  onRetry: () => void;
}) {
  const data = resource.data;
  const overview = data?.overview;
  return (
    <View className="gap-3">
      <AppText variant="section">身体状态</AppText>
      <HomeResourceFeedback
        {...resource}
        label="状态与待办"
        cached={!!data}
        onRetry={onRetry}
      />
      {resource.loading && !data ? (
        <Spinner accessibilityLabel="正在读取身体状态" />
      ) : null}
      {overview ? (
        <Card>
          <AppText variant="card">{overview.status.label}</AppText>
          <AppText muted className="mt-2">
            {overview.status.explanation}
          </AppText>
          <Disclosure title="展开状态依据">
            {overview.status.evidence.map((evidence) => (
              <AppText
                key={`${evidence.kind}-${evidence.id}`}
                variant="caption"
                muted
                className="mt-2"
              >
                {evidence.date} · {evidence.title}：{evidence.detail}
              </AppText>
            ))}
          </Disclosure>
          <Button variant="ghost" onPress={() => router.push("/(tabs)/coach")}>
            查看状态依据与教练建议
          </Button>
        </Card>
      ) : !resource.loading ? (
        <AppText muted>状态数据暂不可用，请刷新重试。</AppText>
      ) : null}
      {data ? (
        <>
          <AppText variant="section">接下来与待确认</AppText>
          {overview?.goal ? (
            <Card>
              <AppText variant="card">目标 · {overview.goal.title}</AppText>
              <AppText muted className="mt-2">
                {overview.stage
                  ? `${overview.stage.upcoming ? "下一阶段" : "当前阶段"}：${overview.stage.title} · ${overview.stage.purpose}`
                  : overview.stageNotice}
              </AppText>
              <Button
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: "/goals/[goalId]",
                    params: { goalId: overview.goal!.id },
                  })
                }
              >
                查看目标与阶段
              </Button>
            </Card>
          ) : null}
          {data.nextRace ? (
            <Button
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/races/[raceId]",
                  params: { raceId: data.nextRace!.id },
                })
              }
            >
              下一比赛 · {data.nextRace.date} · {data.nextRace.title} ·{" "}
              {data.nextRace.priority} 级
            </Button>
          ) : null}
          {data.suggestions.length ? (
            <Button
              variant="secondary"
              onPress={() => router.push("/(tabs)/coach/suggestions")}
            >
              {data.suggestions.length} 项建议待确认
            </Button>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
