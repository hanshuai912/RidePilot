import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

export type CoachResource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

// Mirrors the repository's focus-based resource hooks. Poll only existing jobs;
// reads never submit generation or application requests.
export function useCoachResource<T>(
  load: () => Promise<T>,
  shouldPoll?: (data: T) => boolean,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      setData(null);
      setLoading(true);
      setError(null);
      const read = async () => {
        try {
          const result = await load();
          if (!active) return;
          setData(result);
          setError(null);
          if (shouldPoll?.(result)) timer = setTimeout(() => void read(), 4000);
        } catch (cause) {
          if (active)
            setError(
              cause instanceof Error ? cause.message : "教练数据加载失败",
            );
        } finally {
          if (active) setLoading(false);
        }
      };
      void read();
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    }, [load, attempt, shouldPoll]),
  );
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, setData, loading, error, retry };
}
