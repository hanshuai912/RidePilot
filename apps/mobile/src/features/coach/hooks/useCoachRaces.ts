import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { coachApi } from "../services/coach.api";
import { localDateInTimezone } from "../model/plan-dates";

export function useCoachRaces(token: string | undefined) {
  const [races, setRaces] = useState<
    Awaited<ReturnType<typeof coachApi.races>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      let active = true;
      setLoading(true);
      setError(null);
      if (!token) {
        setRaces([]);
        setLoading(false);
        return;
      }
      void coachApi
        .races(token)
        .then((items) => {
          if (!active) return;
          const now = new Date();
          setRaces(
            items
              .filter(
                (race) =>
                  race.status === "CONFIRMED" &&
                  race.localDate >= localDateInTimezone(now, race.timezone),
              )
              .sort(
                (a, b) =>
                  a.localDate.localeCompare(b.localDate) ||
                  a.priority.localeCompare(b.priority),
              ),
          );
        })
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error ? cause.message : "赛事读取失败，请重试",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [token, attempt]),
  );
  return {
    races,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
