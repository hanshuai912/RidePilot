import { useEffect, useRef, useState } from "react";
import { CoachApiError } from "../../coach/services/coach.api";

export function useAssessmentMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const request = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run<T>(
    payload: unknown,
    action: (key: string) => Promise<T>,
  ): Promise<T | undefined> {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature)
      request.current = {
        signature,
        key: `assessment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    try {
      const result = await action(request.current.key);
      request.current = null;
      return mounted.current ? result : undefined;
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : "提交失败，输入已保留",
        );
      if (
        cause instanceof CoachApiError &&
        cause.status !== null &&
        cause.status < 500
      )
        request.current = null;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, error, run };
}
