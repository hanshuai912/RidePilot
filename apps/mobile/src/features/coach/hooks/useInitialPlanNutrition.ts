import { useCallback, useEffect, useRef, useState } from "react";
import {
  nutritionProfileInputSchema,
  type NutritionProfileInput,
  type NutritionProfileResponse,
} from "@ridepilot/contracts";
import {
  defaultNutritionProfile,
  profileInputFromResponse,
} from "../../nutrition/model/nutrition";
import {
  NutritionApiError,
  nutritionApi,
} from "../../nutrition/services/nutrition.api";

function sameProfile(a: NutritionProfileInput, b: NutritionProfileInput) {
  const content = (value: NutritionProfileInput) => ({
    dietStyle: value.dietStyle,
    habits: [...value.habits].sort(),
    allergens: [...value.allergens].sort(),
    restrictions: [...value.restrictions].sort(),
    restrictionNote: value.restrictionNote?.trim() || null,
    commonFoods: value.commonFoods,
    mealSchedule: value.mealSchedule,
  });
  return JSON.stringify(content(a)) === JSON.stringify(content(b));
}

export function useInitialPlanNutrition(token: string | undefined) {
  const [form, setForm] = useState<NutritionProfileInput>(
    defaultNutritionProfile,
  );
  const [profile, setProfile] = useState<NutritionProfileResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const loadedRef = useRef(false);
  const readPending = useRef<Promise<void> | null>(null);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    (force = false) => {
      if (!token || (loadedRef.current && !force)) return Promise.resolve();
      if (readPending.current) return readPending.current;
      setLoading(true);
      setError(null);
      const pending = (async () => {
        try {
          const next = await nutritionApi
            .getProfile(token)
            .catch((cause: unknown) => {
              if (cause instanceof NutritionApiError && cause.status === 404)
                return null;
              throw cause;
            });
          if (!mounted.current) return;
          setProfile(next);
          setForm(
            next ? profileInputFromResponse(next) : defaultNutritionProfile,
          );
          loadedRef.current = true;
          setLoaded(true);
          setConflict(false);
        } catch (cause) {
          if (mounted.current)
            setError(
              cause instanceof Error
                ? cause.message
                : "读取饮食档案失败，请重试",
            );
        } finally {
          readPending.current = null;
          if (mounted.current) setLoading(false);
        }
      })();
      readPending.current = pending;
      return pending;
    },
    [token],
  );

  const save = async (): Promise<boolean> => {
    if (!token || savingRef.current) return false;
    if (!loadedRef.current) {
      setError("请先读取饮食档案后再生成");
      return false;
    }
    if (conflict) return false;
    const parsed = nutritionProfileInputSchema.safeParse({
      ...form,
      restrictionNote: form.restrictionNote?.trim() || null,
      expectedVersion: profile?.version,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue.path[0] === "restrictionNote" &&
          form.restrictions.includes("OTHER") &&
          !form.restrictionNote?.trim()
          ? "请补充其他饮食限制的具体食物或成分"
          : issue.path[0] === "mealSchedule"
            ? "请检查用餐时间，使用 HH:mm 格式"
            : issue.path[0] === "commonFoods"
              ? "常吃食物最多 30 项，每项 1–60 字"
              : "请检查饮食档案中的填写内容",
      );
      return false;
    }
    setError(null);
    // Avoid invalidating nutrition drafts by incrementing an unchanged profile.
    if (profile && sameProfile(parsed.data, profileInputFromResponse(profile)))
      return true;
    savingRef.current = true;
    setSaving(true);
    const accept = (next: NutritionProfileResponse) => {
      if (!mounted.current) return false;
      setProfile(next);
      setForm(profileInputFromResponse(next));
      return true;
    };
    try {
      return accept(await nutritionApi.saveProfile(token, parsed.data));
    } catch (cause) {
      // A timed-out PUT may already have succeeded; reconcile before retrying.
      if (cause instanceof NutritionApiError && cause.status === null) {
        try {
          const next = await nutritionApi.getProfile(token);
          if (sameProfile(parsed.data, profileInputFromResponse(next)))
            return accept(next);
        } catch {
          /* Keep the original error and edited form. */
        }
      }
      if (mounted.current) {
        const isConflict =
          cause instanceof NutritionApiError && cause.status === 409;
        setConflict(isConflict);
        setError(
          isConflict
            ? "饮食档案已在其他地方更新，本页修改已保留。请重新读取后核对。"
            : cause instanceof Error
              ? cause.message
              : "保存饮食档案失败，请重试",
        );
      }
      return false;
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return {
    form,
    setForm,
    profile,
    loaded,
    loading,
    saving,
    error,
    conflict,
    load,
    save,
    dirty: !profile || !sameProfile(form, profileInputFromResponse(profile)),
  };
}
