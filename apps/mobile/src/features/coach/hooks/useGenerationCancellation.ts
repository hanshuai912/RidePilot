import { useCallback, useRef, useState } from "react";
import { coachApi } from "../services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";

export function useGenerationCancellation(token?: string, nutrition = false) {
  const [id, setId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const track = useCallback((job: { generationId: string }) => {
    setId(job.generationId);
    setCancelled(false);
    setError(null);
  }, []);
  const reset = useCallback(() => {
    setId(null);
    setCancelled(false);
    setError(null);
  }, []);
  const cancel = async () => {
    if (!token || !id || pending.current || cancelled) return;
    pending.current = true;
    setCancelling(true);
    setError(null);
    try {
      const api = nutrition ? nutritionApi : coachApi;
      await api.cancelGeneration(token, id);
      setCancelled(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "取消失败，请重试");
    } finally {
      pending.current = false;
      setCancelling(false);
    }
  };
  return {
    track,
    reset,
    cancel,
    cancelling,
    cancelled,
    error,
    canCancel: !!id,
  };
}
