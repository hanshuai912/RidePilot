import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { AppText, Badge, Button, Card, Input } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";
import type { RaceNutritionState } from "@ridepilot/contracts";

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
  const [resultStatus, setResultStatus] = useState<
    "COMPLETED" | "PARTIAL" | "DNS" | "DNF"
  >("COMPLETED");
  const [actualDate, setActualDate] = useState("");
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState("");
  const [fatigue, setFatigue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [nutrition, setNutrition] = useState<RaceNutritionState | null>(null);
  useFocusEffect(
    useCallback(() => {
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
          if (saved) {
            setResultStatus(saved.status);
            setActualDate(saved.actualDate);
            setDuration(
              saved.durationSeconds ? String(saved.durationSeconds) : "",
            );
            setRpe(saved.rpe ? String(saved.rpe) : "");
            setFatigue(saved.fatigue ? String(saved.fatigue) : "");
            setNotes(saved.notes ?? "");
          }
        })
        .catch((cause: unknown) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "赛事读取失败");
        });
      return () => {
        active = false;
      };
    }, [token, raceId]),
  );
  const saveResult = async () => {
    if (!token || !race) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await coachApi.saveRaceResult(token, race.id, {
        status: resultStatus,
        actualDate,
        durationSeconds: duration ? Number(duration) : null,
        rpe: rpe ? Number(rpe) : null,
        fatigue: fatigue ? Number(fatigue) : null,
        notes: notes || null,
        expectedVersion: result?.version,
      });
      setResult(saved);
      setRace({ ...race, status: "COMPLETED", version: race.version + 1 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存赛事结果失败");
    } finally {
      setBusy(false);
    }
  };
  const cancelRace = async () => {
    if (!token || !race || race.status !== "CONFIRMED") return;
    setBusy(true);
    setError(null);
    try {
      setRace(
        await coachApi.updateRace(token, race.id, {
          status: "CANCELLED",
          expectedVersion: race.version,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "取消赛事失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <TrainingPage title="赛事详情" loading={!race && !error} error={error}>
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
            <Button
              className="mt-4"
              variant="secondary"
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
                取消赛事
              </Button>
            ) : null}
          </Card>
          {impact ? (
            <Card>
              <AppText variant="card">当前影响预览</AppText>
              <AppText variant="caption" muted className="mt-2">
                预计影响比赛前后 7 天，当前正式训练版本 v
                {impact.currentTrainingVersion}。
              </AppText>
              {impact.conflicts.length ? (
                impact.conflicts.map((conflict) => (
                  <AppText
                    key={`${conflict.kind}-${conflict.title}`}
                    className="mt-2 text-warning"
                  >
                    {conflict.title} ·{" "}
                    {conflict.severity === "BLOCKER" ? "需要处理" : "建议检查"}
                  </AppText>
                ))
              ) : (
                <AppText className="mt-3 text-positive">
                  比赛当天暂无已知冲突。
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
                生成备赛调整草稿
              </Button>
            </Card>
          ) : null}
          <Card>
            <AppText variant="card">赛后结果</AppText>
            <ViewChoices
              options={
                [
                  ["COMPLETED", "完成"],
                  ["PARTIAL", "部分完成"],
                  ["DNS", "未出发"],
                  ["DNF", "未完赛"],
                ] as const
              }
              value={resultStatus}
              onChange={(value) =>
                setResultStatus(value as typeof resultStatus)
              }
            />
            <AppText variant="label" muted className="mt-4">
              实际日期
            </AppText>
            <Input
              className="mt-2"
              value={actualDate}
              onChangeText={setActualDate}
              placeholder={race.localDate}
            />
            <AppText variant="label" muted className="mt-4">
              用时（秒，可选）
            </AppText>
            <Input
              className="mt-2"
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              placeholder="14400"
            />
            <View className="mt-3 flex-row gap-2">
              <Input
                className="flex-1"
                value={rpe}
                onChangeText={setRpe}
                keyboardType="number-pad"
                placeholder="RPE 1-10"
              />
              <Input
                className="flex-1"
                value={fatigue}
                onChangeText={setFatigue}
                keyboardType="number-pad"
                placeholder="疲劳 1-10"
              />
            </View>
            <Input
              className="mt-3"
              value={notes}
              onChangeText={setNotes}
              placeholder="比赛感受和异常情况"
              maxLength={500}
            />
            <Button
              className="mt-4"
              loading={busy}
              onPress={() => void saveResult()}
            >
              {result ? "更新结果" : "保存结果"}
            </Button>
            <AppText variant="caption" muted className="mt-2">
              保存结果不会自动修改训练计划，可在 AI 教练中生成赛后恢复草稿。
            </AppText>
            {result ? (
              <Button
                className="mt-3"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/races/proposal",
                    params: { raceId: race.id, recovery: "1" },
                  } as never)
                }
              >
                生成赛后恢复草稿
              </Button>
            ) : null}
          </Card>
          <Card>
            <AppText variant="card">比赛补给</AppText>
            <AppText variant="caption" muted className="mt-2">
              赛前、比赛中和赛后补给会生成独立营养草稿，确认后才会更新正式饮食计划。
            </AppText>
            <Button
              className="mt-3"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/races/nutrition-proposal",
                  params: { raceId: race.id },
                } as never)
              }
            >
              {nutrition?.proposal?.status === "APPLIED"
                ? "查看赛事补给方案"
                : nutrition?.proposal
                  ? "查看赛事补给草稿"
                  : nutrition?.generation
                    ? "继续生成赛事补给草稿"
                    : "生成赛事补给草稿"}
            </Button>
          </Card>
        </>
      ) : null}
    </TrainingPage>
  );
}

function ViewChoices({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {options.map(([key, label]) => (
        <Button
          key={key}
          size="sm"
          variant={value === key ? "primary" : "secondary"}
          onPress={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </View>
  );
}
