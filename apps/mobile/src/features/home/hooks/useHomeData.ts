import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type {
  CalendarResponse,
  HomeTodayResponse,
  HomeTraining,
  NutritionPlanResponse,
} from "@ridepilot/contracts";
import { localDateInTimezone } from "../../coach/model/plan-dates";
import { homeApi } from "../services/home.api";

export type HomeResource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};
const initial = <T>(): HomeResource<T> => ({
  data: null,
  loading: true,
  error: null,
});
type State = {
  profile: HomeResource<HomeTodayResponse["profile"]>;
  training: HomeResource<HomeTraining>;
  nutrition: HomeResource<NutritionPlanResponse>;
  date: string | null;
};
const resource = <T>(
  data: T | null,
  error: string | null = null,
): HomeResource<T> => ({ data, loading: false, error });

export function useHomeData(token: string) {
  const [state, setState] = useState<State>({
    profile: initial(),
    training: initial(),
    nutrition: initial(),
    date: null,
  });
  const version = useRef(0);
  const focused = useRef(false);
  const current = useRef<{ date: string; timezone: string } | null>(null);
  const refresh = useCallback(async () => {
    const requestId = ++version.current;
    const context = current.current;
    const preserve =
      !!context &&
      localDateInTimezone(new Date(), context.timezone) === context.date;
    setState((previous) => ({
      ...previous,
      profile: { ...previous.profile, loading: true, error: null },
      training: {
        data: preserve ? previous.training.data : null,
        loading: true,
        error: null,
      },
      nutrition: {
        data: preserve ? previous.nutrition.data : null,
        loading: true,
        error: null,
      },
    }));
    try {
      const response = await homeApi.today(token);
      if (version.current !== requestId) return;
      const sameDate = current.current?.date === response.localDate;
      current.current = {
        date: response.localDate,
        timezone: response.profile.timezone,
      };
      setState((previous) => ({
        date: response.localDate,
        profile: resource(response.profile),
        training:
          response.training.status === "READY"
            ? resource(response.training.data)
            : resource(
                sameDate ? previous.training.data : null,
                response.training.error.message,
              ),
        nutrition:
          response.nutrition.status === "READY"
            ? resource(response.nutrition.data)
            : resource(
                sameDate ? previous.nutrition.data : null,
                response.nutrition.error.message,
              ),
      }));
    } catch (cause) {
      if (version.current !== requestId) return;
      const message =
        cause instanceof Error ? cause.message : "首页暂时无法读取，请重试";
      setState((previous) => ({
        ...previous,
        profile: { ...previous.profile, loading: false, error: message },
        training: {
          ...previous.training,
          loading: false,
          error: "今日安排尚未更新，请重试",
        },
        nutrition: {
          ...previous.nutrition,
          loading: false,
          error: "今日安排尚未更新，请重试",
        },
      }));
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void refresh();
      return () => {
        focused.current = false;
        version.current += 1;
      };
    }, [refresh]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active" && focused.current) void refresh();
    });
    const timer = setInterval(() => {
      const context = current.current;
      if (
        focused.current &&
        context &&
        localDateInTimezone(new Date(), context.timezone) !== context.date
      )
        void refresh();
    }, 30_000);
    return () => {
      subscription?.remove();
      clearInterval(timer);
      version.current += 1;
    };
  }, [refresh]);

  return {
    profile: state.profile,
    plan: {
      ...state.training,
      data: state.training.data?.plan ?? null,
      error: null,
    },
    training: {
      ...state.training,
      data: state.training.data?.calendar ?? null,
    },
    next: {
      ...state.training,
      data: state.training.data?.nextWorkout ?? null,
    } as HomeResource<CalendarResponse["items"][number]>,
    nutrition: state.nutrition,
    date: state.date,
    refresh,
  };
}
