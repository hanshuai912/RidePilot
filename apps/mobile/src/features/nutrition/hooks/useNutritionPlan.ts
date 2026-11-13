import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type {
  NutritionPlanResponse,
  NutritionProfileInput,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile } from "../../profile/services/profile.api";
import { useGenerationCancellation } from "../../coach/hooks/useGenerationCancellation";
import { localDateInTimezone } from "../../coach/model/plan-dates";
import { waitForNutritionProposal } from "../services/generation-task";
import { NutritionApiError, nutritionApi } from "../services/nutrition.api";

type NutritionItem = NutritionPlanResponse["items"][number];
type SwapReason =
  | "DISLIKE"
  | "MISSING_INGREDIENT"
  | "EATING_OUT"
  | "LIMITED_PREP_TIME"
  | "TRAINING_CHANGED";
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useNutritionPlan() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const cancellation = useGenerationCancellation(token, true);
  const [date, setDate] = useState<string | null>(null);
  const [profile, setProfile] = useState<Awaited<
    ReturnType<typeof nutritionApi.getProfile>
  > | null>(null);
  const [plan, setPlan] = useState<NutritionPlanResponse | null>(null);
  const [proposal, setProposal] = useState<NutritionProposalResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<
    "QUEUED" | "RUNNING" | null
  >(null);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [swapItem, setSwapItem] = useState<NutritionItem | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">(
    "error",
  );
  const [profileError, setProfileError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const reportError = useCallback((message: string) => {
    setFeedbackTone("error");
    setFeedback(message);
  }, []);
  const [attempt, setAttempt] = useState(0);
  const operation = useRef(0);

  useEffect(
    () => () => {
      operation.current += 1;
    },
    [],
  );

  const load = useCallback(async () => {
    if (!token) return;
    void attempt;
    const account = await getProfile(token);
    const today = localDateInTimezone(new Date(), account.timezone);
    setDate(today);
    const [profileResult, planResult] = await Promise.allSettled([
      nutritionApi.getProfile(token),
      nutritionApi.getPlan(token, today),
    ]);
    if (profileResult.status === "fulfilled") {
      setProfile(profileResult.value);
    } else if (
      profileResult.reason instanceof NutritionApiError &&
      profileResult.reason.status === 404
    ) {
      setProfile(null);
    } else {
      throw profileResult.reason;
    }
    if (planResult.status === "fulfilled") setPlan(planResult.value);
    else throw planResult.reason;
  }, [token, attempt]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load()
        .catch((error: unknown) => {
          if (active) reportError(errorMessage(error, "饮食计划暂时无法加载"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load, reportError]),
  );

  const saveProfile = async (input: NutritionProfileInput) => {
    if (!token) return;
    setSavingProfile(true);
    setProfileError(null);
    setFeedback(null);
    try {
      const next = await nutritionApi.saveProfile(token, {
        ...input,
        expectedVersion: profile?.version,
      });
      setProfile(next);
      setProfileOpen(false);
      setFeedbackTone("success");
      setFeedback("饮食档案已保存");
    } catch (error) {
      setProfileError(errorMessage(error, "饮食档案保存失败，请重试"));
    } finally {
      setSavingProfile(false);
    }
  };

  const generate = async () => {
    if (!token || !plan || !profile || !date) {
      setProfileOpen(true);
      return;
    }
    cancellation.reset();
    setGenerating(true);
    setGenerationStatus("QUEUED");
    setFeedback(null);
    const currentOperation = operation.current;
    try {
      const initial = await nutritionApi.generate(token, {
        startDate: date,
        endDate: date,
        mode: plan.status === "NOT_GENERATED" ? "INITIAL" : "REGENERATE",
        expectedNutritionVersion: plan.version,
      });
      cancellation.track(initial);
      const next = await waitForNutritionProposal(
        token,
        initial,
        setGenerationStatus,
        () => operation.current === currentOperation,
      );
      if (next) setProposal(next);
    } catch (error) {
      reportError(errorMessage(error, "营养草稿生成失败，请稍后重试"));
    } finally {
      setGenerating(false);
      setGenerationStatus(null);
    }
  };

  const validate = async () => {
    if (!token || !proposal) return;
    setValidating(true);
    try {
      setProposal(await nutritionApi.validate(token, proposal.proposalId));
    } catch (error) {
      reportError(errorMessage(error, "草稿校验失败，请重试"));
    } finally {
      setValidating(false);
    }
  };

  const apply = async () => {
    if (!token || !proposal || !plan) return;
    setApplying(true);
    try {
      const result = await nutritionApi.apply(
        token,
        proposal.proposalId,
        plan.version,
      );
      setProposal(null);
      setFeedbackTone("success");
      setFeedback(
        `饮食计划已应用，更新了 ${result.affectedDates.length} 天安排`,
      );
      setAttempt((value) => value + 1);
    } catch (error) {
      reportError(errorMessage(error, "应用失败，正式饮食计划没有变化"));
    } finally {
      setApplying(false);
    }
  };

  const swap = async ({
    item,
    reason,
    foodName,
  }: {
    item: NutritionItem;
    reason: SwapReason;
    foodName: string;
  }) => {
    if (!token || !plan) return;
    setSwapping(true);
    setSwapError(null);
    try {
      const firstFood = item.foods[0];
      const next = await nutritionApi.createMealSwap(token, {
        itemId: item.id,
        reason,
        expectedNutritionVersion: plan.version,
        replacement: {
          localDate: item.localDate,
          mealType: item.mealType,
          scheduledLocalTime: item.scheduledLocalTime,
          title: foodName,
          foods: [
            {
              name: foodName,
              amount: firstFood?.amount ?? 1,
              unit: firstFood?.unit ?? "serving",
              allergenTags: [],
              ingredientStatus: "PARTIAL",
            },
          ],
          nutrients: {
            energyKcal: null,
            carbohydrateG: null,
            proteinG: null,
            fatG: null,
            fluidMl: null,
            sodiumMg: null,
          },
          nutritionSource: "USER_ENTERED",
          confidence: "LOW",
          linkedWorkoutId: item.linkedWorkoutId,
          notes: "替换食材后请结合食品标签补充营养信息",
        },
      });
      setProposal(next);
      setSwapItem(null);
    } catch (error) {
      setSwapError(errorMessage(error, "替换草稿生成失败，请重试"));
    } finally {
      setSwapping(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setFeedback(null);
    try {
      await load();
    } catch (error) {
      reportError(errorMessage(error, "饮食计划暂时无法加载"));
    } finally {
      setRefreshing(false);
    }
  };
  return {
    token,
    date,
    profile,
    plan,
    proposal,
    loading,
    refreshing,
    savingProfile,
    generating,
    generationStatus,
    validating,
    applying,
    swapping,
    feedback,
    feedbackTone,
    profileError,
    swapError,
    profileOpen,
    swapItem,
    cancellation,
    items: plan?.items ?? [],
    saveProfile,
    generate,
    validate,
    apply,
    swap,
    refresh,
    reportError,
    acceptProposal: setProposal,
    dismissProposal: () => setProposal(null),
    openProfile: () => {
      setProfileError(null);
      setProfileOpen(true);
    },
    closeProfile: () => setProfileOpen(false),
    openSwap: (item: NutritionItem) => {
      setSwapError(null);
      setSwapItem(item);
    },
    closeSwap: () => setSwapItem(null),
  };
}
