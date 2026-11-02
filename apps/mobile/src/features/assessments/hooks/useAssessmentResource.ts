import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../auth/hooks/AuthProvider";

// Refresh on return from a form/settings; a failed refresh retains readable data.
export function useAssessmentResource<T>(load: (token: string) => Promise<T>) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void attempt;
      setLoading(true);
      if (!token) {
        setError("请先登录");
        setLoading(false);
        return;
      }
      Promise.resolve()
        .then(() => load(token))
        .then((value) => {
          if (active) {
            setData(value);
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "读取测试失败");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load, token, attempt]),
  );
  return {
    data,
    token,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
