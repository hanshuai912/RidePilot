import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";

// Refresh only the capability when returning from settings. Caller-owned forms
// and local workout drafts are deliberately left intact.
export function useFtpRequirement() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void attempt;
      let active = true;
      if (!token) return;
      setError(null);
      coachApi
        .ftp(token)
        .then((ftp) => {
          if (active) setAvailable(!!ftp);
        })
        .catch((cause: unknown) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "FTP 读取失败");
        });
      return () => {
        active = false;
      };
    }, [token, attempt]),
  );
  return { available, error, retry: () => setAttempt((value) => value + 1) };
}
