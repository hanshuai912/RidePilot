import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  AppText,
  Badge,
  Button,
  Card,
  Disclosure,
} from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";
import { RaceResultCard } from "../components/RaceResultCard";
import type { RaceNutritionState, RaceResultInput } from "@ridepilot/contracts";

export function RaceDetailScreen() {
  const { raceId = "" } = useLocalSearchParams<{ raceId?: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const [race, setRace] = useState<Awaited<
    ReturnType<typeof coachApi.race>
  > | null>(null);
  const [impact, setImpact] = useState<Awaited<
    ReturnType<typeof coachApi.raceImpact>
  > | null>(null);
  const [result, setResult] =
    useState<Awaited<ReturnType<typeof coachApi.raceResult>>>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [nutrition, setNutrition] = useState<RaceNutritionState | null>(null);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      if (!token || !raceId) return;
      let active = true;
      Promise.all([
        coachApi.race(token, raceId),
        coachApi.raceImpact(token, raceId),
        coachApi.raceResult(token, raceId),
        nutritionApi.raceState(token, raceId),
      ])
        .then(([current, preview, saved, currentNutrition]) => {
          if (!active) return;
          setRace(current);
          setImpact(preview);
          setResult(saved);
          setNutrition(currentNutrition);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "赛事读取失败");
        });
      return () => {
        active = false;
      };
    }, [token, raceId, attempt]),
  );
  const saveResult = async (input: RaceResultInput) => {
    if (!token || !race || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await coachApi.saveRaceResult(token, race.id, input);
      setResult(saved);
      setRace({ ...race, status: "COMPLETED", version: race.version + 1 });
      setImpact(await coachApi.raceImpact(token, race.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存赛事结果失败");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const cancelRace = async () => {
    if (!token || !race || pending.current || race.status !== "CONFIRMED")
      return;
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      setRace(
        await coachApi.updateRace(token, race.id, {
          status: "CANCELLED",
          expectedVersion: race.version,
        }),
      );
      setConfirmCancel(false);
      setImpact(await coachApi.raceImpact(token, race.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "取消赛事失败");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const eventNutrition =
    race?.status === "CONFIRMED" &&
    !(impact?.startDate && impact.startDate > race.localDate);
  return (
    <TrainingPage
      title="赛事详情"
      loading={!race && !error}
      error={!race ? error : undefined}
      retry={() => setAttempt((value) => value + 1)}
    >
      {race && error ? (
        <AppText className="text-negative">{error}</AppText>
      ) : null}
      {race ? (
        <>
          <Card>
            <Badge variant={race.priority === "A" ? "brand" : "neutral"}>
              {race.priority} 级赛事
            </Badge>
            <AppText variant="section" className="mt-3">
              {race.name}
            </AppText>
            <AppText variant="body" muted className="mt-2">
              {race.localDate} · {race.distanceKm} km ·{" "}
              {race.status === "CONFIRMED"
                ? "已确认"
                : race.status === "COMPLETED"
                  ? "已完成"
                  : "已取消"}
            </AppText>
          </Card>
          {impact ? (
            <Card>
              <AppText variant="card">当前影响预览</AppText>
              <AppText variant="caption" muted className="mt-2">
                默认影响范围 {impact.startDate} 至 {impact.endDate}
                ，可在计划页面修改。当前正式训练版本 v
                {impact.currentTrainingVersion}。
              </AppText>
              {impact.conflicts.length ? (
                impact.conflicts.map((conflict) => (
                  <AppText
                    key={`${conflict.kind}-${conflict.title}`}
                    className="mt-2 text-warning"
                  >
                    {conflict.date} · {conflict.title} ·{" "}
                    {conflict.severity === "BLOCKER" ? "需要处理" : "建议检查"}
                  </AppText>
                ))
              ) : (
                <AppText className="mt-3 text-positive">
                  当前范围暂无已知冲突。
                </AppText>
              )}
              <Button
                className="mt-4"
                onPress={() =>
                  router.push({
                    pathname: "/races/proposal",
                    params: { raceId: race.id },
                  } as never)
                }
              >
                {race.status === "CANCELLED"
                  ? "取消后重新规划"
                  : race.status === "COMPLETED"
                    ? "查看赛后恢复计划"
                    : "查看备赛计划与草稿"}
              </Button>
            </Card>
          ) : null}
          {race.status !== "CANCELLED" ? (
            <Disclosure
              title={result ? "比赛结果" : "记录比赛结果"}
              defaultExpanded={!!result || race.status === "COMPLETED"}
              keepMounted
            >
              <RaceResultCard
                key={result?.version ?? 0}
                raceId={race.id}
                raceDate={race.localDate}
                result={result}
                busy={busy}
                onSave={saveResult}
              />
            </Disclosure>
          ) : null}
          <Card>
            <AppText variant="card">比赛补给</AppText>
            <AppText variant="caption" muted className="mt-2">
              赛前、比赛中和赛后补给会生成独立营养草稿，确认后才会更新正式饮食计划。
            </AppText>
            <Button
              className="mt-3"
              variant="secondary"
              onPress={() =>
                !eventNutrition
                  ? router.push("/(tabs)/nutrition")
                  : router.push({
                      pathname: "/races/nutrition-proposal",
                      params: { raceId: race.id },
                    })
              }
            >
              {!eventNutrition
                ? "查看正式饮食计划"
                : nutrition?.proposal?.status === "APPLIED"
                  ? "查看赛事补给方案"
                  : nutrition?.proposal
                    ? "查看赛事补给草稿"
                    : nutrition?.generation
                      ? "继续生成赛事补给草稿"
                      : "生成赛事补给草稿"}
            </Button>
          </Card>
          {race.status !== "COMPLETED" ? (
            <Disclosure title="管理赛事">
              {confirmCancel ? (
                <Card>
                  <AppText>
                    取消只更新赛事状态。原训练与补给会保留，请随后手动生成回归目标的计划。
                  </AppText>
                  <Button
                    variant="secondary"
                    onPress={() => setConfirmCancel(false)}
                  >
                    保留赛事
                  </Button>
                </Card>
              ) : null}

              <Button
                className="mt-4"
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  router.push({
                    pathname: "/races/edit",
                    params: { raceId: race.id },
                  } as never)
                }
              >
                编辑赛事
              </Button>
              {race.status === "CONFIRMED" ? (
                <Button
                  className="mt-2"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => void cancelRace()}
                >
                  {confirmCancel ? "确认取消赛事" : "取消赛事"}
                </Button>
              ) : null}
            </Disclosure>
          ) : null}
        </>
      ) : null}
    </TrainingPage>
  );
}
