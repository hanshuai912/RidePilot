import { router } from "expo-router";
import type { coachApi } from "../../coach/services/coach.api";
import { AppText, Button, Card } from "../../../components/ui";

export function RaceDayEvents({
  races,
}: {
  races: Awaited<ReturnType<typeof coachApi.races>>;
}) {
  return (
    <>
      {races.map((race) => (
        <Card key={race.id}>
          <AppText variant="card">比赛 · {race.name}</AppText>
          <AppText muted className="mt-2">
            {race.priority} 级 · {race.distanceKm} km · {race.timezone} ·{" "}
            {race.status === "COMPLETED" ? "已完成" : "已确认"}
          </AppText>
          <Button
            variant="secondary"
            className="mt-3"
            onPress={() =>
              router.push({
                pathname: "/races/[raceId]",
                params: { raceId: race.id },
              })
            }
          >
            查看赛事与备赛安排
          </Button>
        </Card>
      ))}
    </>
  );
}
