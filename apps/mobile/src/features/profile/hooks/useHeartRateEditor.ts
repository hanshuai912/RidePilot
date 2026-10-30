import { useEffect, useRef, useState } from "react";
import { type HeartRateResponse } from "@ridepilot/contracts";
import {
  parseHeartRateDraft,
  toHeartRateDraft,
  type HeartRateDraft,
} from "../model/heart-rate-draft";
import { heartRateApi } from "../services/heart-rate.api";

export function useHeartRateEditor(token?: string) {
  const [original, setOriginal] = useState<HeartRateResponse | null>(null);
  const [draft, setDraft] = useState<HeartRateDraft>(() => toHeartRateDraft());
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!token) return;
    let active = true;
    void heartRateApi
      .get(token)
      .then((result) => {
        if (!active) return;
        setOriginal(result);
        setDraft(toHeartRateDraft(result));
        setLoaded(true);
        setError(null);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "读取心率设置失败，请重试",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, attempt]);
  const parsed = parseHeartRateDraft(draft);
  const baseline = toHeartRateDraft(original);
  const dirty =
    loaded &&
    (Object.keys(draft) as (keyof HeartRateDraft)[]).some(
      (key) => draft[key].trim() !== baseline[key],
    );
  const update = (patch: Partial<HeartRateDraft>) => {
    if (inFlight.current) return;
    setDraft((current) => ({ ...current, ...patch }));
  };
  const save = async () => {
    if (!token || !loaded || !dirty || !parsed.valid || inFlight.current)
      return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await heartRateApi.save(token, {
        ...parsed.values,
        expectedVersion: original?.version ?? 0,
      });
      setOriginal(result);
      setDraft(toHeartRateDraft(result));
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存心率设置失败，请重试",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return {
    draft,
    update,
    ...parsed,
    dirty,
    loaded,
    loading,
    saving,
    saved,
    error,
    save,
    reload: () => {
      setLoading(true);
      setError(null);
      setAttempt((current) => current + 1);
    },
  };
}
