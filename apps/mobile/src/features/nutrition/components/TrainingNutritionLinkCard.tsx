import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { addDays } from "../../coach/model/plan-dates";
import { nutritionApi } from "../services/nutrition.api";

export function TrainingNutritionLinkCard({
  dates,
  checkStatus = false,
}: {
  dates: string[];
  checkStatus?: boolean;
}) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const sorted = [...dates].sort();
  const from = sorted[0];
  const end = sorted.at(-1);
  const to =
    from && end
      ? end > addDays(from, 30)
        ? addDays(from, 30)
        : end
      : undefined;
  const [affected, setAffected] = useState<string[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      if (!checkStatus || !token || !from || !to) return;
      let active = true;
      setError(false);
      setAffected(null);
      void nutritionApi
        .trainingState(token, from, to)
        .then((state) => {
          if (active) setAffected(state.affectedDates);
        })
        .catch(() => {
          if (active) setError(true);
        });
      return () => {
        active = false;
      };
    }, [checkStatus, token, from, to, attempt]),
  );
  if (!from || !to) return null;
  return (
    <Card className="border-brand/50 p-4">
      <AppText variant="card">训练与补给联动</AppText>
      <AppText variant="caption" muted className="mt-2">
        {from} 至 {to}
      </AppText>
      <AppText variant="caption" className="mt-2 text-warning">
        {!checkStatus
          ? "训练已应用。可检查这些日期的补给，确认后单独更新饮食。"
          : error
            ? "暂时无法核对补给状态，请重试。"
            : affected === null
              ? "正在核对这段时间的训练与补给"
              : affected.length === 0
                ? "所选日期的补给已按训练核对。"
                : "训练与现有补给可能不匹配，可手动生成调整建议。确认应用前保留现有饮食。"}
      </AppText>
      {affected?.length ? (
        <AppText variant="caption" muted className="mt-2">
          待核对：{affected.join("、")}
        </AppText>
      ) : null}
      {end && end > to ? (
        <AppText variant="caption" muted className="mt-2">
          本次先检查前 31 天，其他日期可分批选择。
        </AppText>
      ) : null}
      <Button
        className="mt-3"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: "/nutrition/training-linked",
            params: { from, to },
          })
        }
      >
        查看训练补给联动
      </Button>
      {error ? (
        <Button
          variant="ghost"
          onPress={() => setAttempt((value) => value + 1)}
        >
          重新核对
        </Button>
      ) : null}
    </Card>
  );
}
