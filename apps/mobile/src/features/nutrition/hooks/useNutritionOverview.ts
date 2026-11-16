import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type {
  NutritionPlanResponse,
  NutritionProfileResponse,
} from "@ridepilot/contracts";
import { getProfile } from "../../profile/services/profile.api";
import { localDateInTimezone } from "../../coach/model/plan-dates";
import { NutritionApiError, nutritionApi } from "../services/nutrition.api";

// Keep date reads separate from draft mutations. Every read is tied to its
// date and revision so a slow previous response cannot appear under a new day.
export function useNutritionOverview(token: string | undefined) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [context, setContext] = useState<{
    token: string;
    today: string;
    revision: number;
  } | null>(null);
  const [profile, setProfile] = useState<NutritionProfileResponse | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);
  const activeContext = context?.token === token ? context : null;
  const date = activeContext ? (selectedDate ?? activeContext.today) : null;
  const revision = activeContext?.revision ?? 0;
  const key = `${token}:${date}:${revision}`;
  const [day, setDay] = useState<{
    key: string;
    plan: NutritionPlanResponse | null;
    error: string | null;
  } | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    const request = ++sequence.current;
    setContextLoading(true);
    setContextError(null);
    try {
      const [account, nutrition] = await Promise.allSettled([
        getProfile(token),
        nutritionApi.getProfile(token),
      ]);
      if (request !== sequence.current) return;
      if (account.status === "rejected") throw account.reason;
      if (
        nutrition.status === "rejected" &&
        !(
          nutrition.reason instanceof NutritionApiError &&
          nutrition.reason.status === 404
        )
      )
        throw nutrition.reason;
      setProfile(nutrition.status === "fulfilled" ? nutrition.value : null);
      setContext({
        token,
        today: localDateInTimezone(new Date(), account.value.timezone),
        revision: request,
      });
    } catch (cause) {
      if (request === sequence.current)
        setContextError(
          cause instanceof Error ? cause.message : "饮食资料暂时无法加载",
        );
    } finally {
      if (request === sequence.current) setContextLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        sequence.current += 1;
      };
    }, [reload]),
  );

  useEffect(() => {
    if (!token || !date) return;
    let active = true;
    void nutritionApi.getPlan(token, date).then(
      (plan) => {
        if (active) setDay({ key, plan, error: null });
      },
      (cause: unknown) => {
        if (active)
          setDay({
            key,
            plan: null,
            error:
              cause instanceof Error ? cause.message : "当天饮食暂时无法加载",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [token, date, key]);

  const currentDay = day?.key === key ? day : null;
  return {
    date,
    today: activeContext?.today ?? null,
    revision,
    profile,
    setProfile,
    plan: contextLoading || contextError ? null : (currentDay?.plan ?? null),
    loading: contextLoading || (!!date && !currentDay),
    readError: contextError ?? currentDay?.error ?? null,
    refreshing,
    selectDate: setSelectedDate,
    reload,
    refresh: async () => {
      setRefreshing(true);
      try {
        await reload();
      } finally {
        setRefreshing(false);
      }
    },
  };
}
