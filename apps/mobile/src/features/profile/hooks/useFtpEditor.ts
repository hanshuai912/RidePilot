import { useEffect, useRef, useState } from "react";
import { coachApi } from "../../coach/services/coach.api";
import { parseFtpWatts } from "../model/power-zones";

export function useFtpEditor(token?: string) {
  const [original, setOriginal] = useState<number | null>(null);
  const [watts, setWatts] = useState("");
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
    void coachApi
      .ftp(token)
      .then((ftp) => {
        if (!active) return;
        setOriginal(ftp?.valueWatts ?? null);
        setWatts(ftp?.valueWatts.toString() ?? "");
        setLoaded(true);
        setError(null);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "读取 FTP 失败，请重试",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, attempt]);
  const value = parseFtpWatts(watts);
  const dirty =
    loaded &&
    (value !== null
      ? value !== original
      : watts.trim() !== (original?.toString() ?? ""));
  const save = async () => {
    if (!token || !loaded || !dirty || value === null || inFlight.current)
      return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await coachApi.addFtp(token, value);
      setOriginal(result.valueWatts);
      setWatts(result.valueWatts.toString());
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存 FTP 失败，请重试",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return {
    watts,
    setWatts,
    value,
    dirty,
    loaded,
    loading,
    saving,
    saved,
    error,
    save,
    invalid: watts.trim() !== "" && value === null,
    reload: () => {
      setLoading(true);
      setError(null);
      setAttempt((current) => current + 1);
    },
  };
}
