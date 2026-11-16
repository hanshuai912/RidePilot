import { useEffect, useState } from "react";
import { nutritionApi } from "../services/nutrition.api";

export function useNutritionScheduleRange(
  token: string,
  from: string,
  to: string,
  revision: number,
) {
  const [attempt, setAttempt] = useState(0);
  const key = `${token}:${from}:${to}:${revision}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    dates: Set<string>;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void nutritionApi.getPlanRange(token, from, to).then(
      (plan) => {
        if (active)
          setResult({
            key,
            dates: new Set(plan.items.map((item) => item.localDate)),
            error: null,
          });
      },
      (cause: unknown) => {
        if (active)
          setResult({
            key,
            dates: new Set(),
            error:
              cause instanceof Error ? cause.message : "安排日期暂时无法加载",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [token, from, to, key]);
  const current = result?.key === key ? result : null;
  return {
    dates: current?.dates ?? new Set<string>(),
    loading: !current,
    error: current?.error ?? null,
    retry: () => setAttempt((value) => value + 1),
  };
}
