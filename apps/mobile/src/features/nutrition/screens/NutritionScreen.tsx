import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Settings2, Sparkles } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import type {
  NutritionPlanResponse,
  NutritionProfileInput,
  NutritionProposalResponse,
} from "@ridepilot/contracts";

import { AppHeader } from "../../../components/layout/AppHeader";
import { Screen } from "../../../components/layout/Screen";
import { AppText, Badge, Button, Card, EmptyState, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { NutritionMealCard } from "../components/NutritionMealCard";
import { NutritionProfileSheet } from "../components/NutritionProfileSheet";
import { NutritionProposalCard } from "../components/NutritionProposalCard";
import { NutritionSwapSheet } from "../components/NutritionSwapSheet";
import { profileInputFromResponse, todayLocalDate } from "../model/nutrition";
import { waitForNutritionProposal } from "../services/generation-task";
import { NutritionApiError, nutritionApi } from "../services/nutrition.api";

type NutritionItem = NutritionPlanResponse["items"][number];
type SwapReason = "DISLIKE" | "MISSING_INGREDIENT" | "EATING_OUT" | "LIMITED_PREP_TIME" | "TRAINING_CHANGED";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function sectionTitle(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}

export function NutritionScreen() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const date = todayLocalDate();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof nutritionApi.getProfile>> | null>(null);
  const [plan, setPlan] = useState<NutritionPlanResponse | null>(null);
  const [proposal, setProposal] = useState<NutritionProposalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<"QUEUED" | "RUNNING" | null>(null);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [swapItem, setSwapItem] = useState<NutritionItem | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const operation = useRef(0);

  useEffect(() => () => {
    operation.current += 1;
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setFeedback(null);
    const [profileResult, planResult] = await Promise.allSettled([
      nutritionApi.getProfile(token),
      nutritionApi.getPlan(token, date),
    ]);
    if (profileResult.status === "fulfilled") {
      setProfile(profileResult.value);
    } else if (profileResult.reason instanceof NutritionApiError && profileResult.reason.status === 404) {
      setProfile(null);
    } else {
      throw profileResult.reason;
    }
    if (planResult.status === "fulfilled") setPlan(planResult.value);
    else throw planResult.reason;
  }, [date, token]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load()
        .catch((error: unknown) => {
          if (active) setFeedback(errorMessage(error, "饮食计划暂时无法加载"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt, load]),
  );

  const saveProfile = async (input: NutritionProfileInput) => {
    if (!token) return;
    setSavingProfile(true);
    setFeedback(null);
    try {
      const next = await nutritionApi.saveProfile(token, {
        ...input,
        expectedVersion: profile?.version,
      });
      setProfile(next);
      setProfileOpen(false);
      setFeedback("饮食档案已保存");
    } catch (error) {
      setFeedback(errorMessage(error, "饮食档案保存失败，请重试"));
    } finally {
      setSavingProfile(false);
    }
  };

  const generate = async () => {
    if (!token || !plan || !profile) {
      setProfileOpen(true);
      return;
    }
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
      const next = await waitForNutritionProposal(
        token,
        initial,
        setGenerationStatus,
        () => operation.current === currentOperation,
      );
      if (next) setProposal(next);
    } catch (error) {
      setFeedback(errorMessage(error, "营养草稿生成失败，请稍后重试"));
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
      setFeedback(errorMessage(error, "草稿校验失败，请重试"));
    } finally {
      setValidating(false);
    }
  };

  const apply = async () => {
    if (!token || !proposal || !plan) return;
    setApplying(true);
    try {
      const result = await nutritionApi.apply(token, proposal.proposalId, plan.version);
      setProposal(null);
      setFeedback(`饮食计划已应用，更新了 ${result.affectedDates.length} 天安排`);
      setAttempt((value) => value + 1);
    } catch (error) {
      setFeedback(errorMessage(error, "应用失败，正式饮食计划没有变化"));
    } finally {
      setApplying(false);
    }
  };

  const swap = async ({ item, reason, foodName }: { item: NutritionItem; reason: SwapReason; foodName: string }) => {
    if (!token || !plan) return;
    setSwapping(true);
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
          foods: [{
            name: foodName,
            amount: firstFood?.amount ?? 1,
            unit: firstFood?.unit ?? "serving",
            allergenTags: [],
            ingredientStatus: "PARTIAL",
          }],
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
      setFeedback(errorMessage(error, "替换草稿生成失败，请重试"));
    } finally {
      setSwapping(false);
    }
  };

  const groupedItems = useMemo(() => plan?.items ?? [], [plan]);

  if (!token) {
    return <Screen><AppText className="p-4">请先登录后查看饮食计划。</AppText></Screen>;
  }

  return (
    <Screen scroll scrollProps={{ contentContainerClassName: "grow gap-5 px-4 pb-10" }}>
      <AppHeader
        eyebrow="NUTRITION"
        title="饮食"
        subtitle={`${sectionTitle(date)} · 今天吃什么，训练前中后怎么补给`}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="编辑饮食档案"
            className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
            onPress={() => setProfileOpen(true)}
          >
            <Settings2 color={colors.textPrimary} size={18} />
          </Pressable>
        }
      />
      {feedback ? <AppText variant="caption" className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-warning">{feedback}</AppText> : null}
      {loading ? <Card className="items-center py-10"><Spinner accessibilityLabel="正在加载饮食计划" /><AppText variant="caption" muted className="mt-3">正在读取今日饮食安排</AppText></Card> : null}
      {!loading && !profile ? (
        <Card className="border-brand/50 bg-surface-elevated p-5">
          <Badge variant="brand">开始前先告诉我</Badge>
          <AppText variant="section" className="mt-3">建立你的饮食档案</AppText>
          <AppText variant="caption" muted className="mt-2 leading-5">选择饮食方式、过敏原和日常习惯，AI 才能生成更安全的餐食建议。</AppText>
          <Button className="mt-5" onPress={() => setProfileOpen(true)}>填写饮食档案</Button>
        </Card>
      ) : null}
      {!loading && profile ? (
        <Card className="p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <AppText variant="label" className="text-brand">饮食档案已建立</AppText>
              <AppText variant="card" className="mt-1">{profile.dietStyle === "OMNIVORE" ? "均衡饮食" : profile.dietStyle === "VEGETARIAN" ? "素食" : profile.dietStyle === "VEGAN" ? "纯植物" : "鱼素"}</AppText>
            </View>
            <Button variant="ghost" size="sm" onPress={() => setProfileOpen(true)}>编辑</Button>
          </View>
          <AppText variant="caption" muted className="mt-2">{profile.allergens.length ? `已避开 ${profile.allergens.length} 项过敏原` : "暂未填写过敏原"} · 档案 v{profile.version}</AppText>
        </Card>
      ) : null}
      {!loading && plan?.dailyTarget ? (
        <Card className="p-4">
          <View className="flex-row items-center justify-between">
            <AppText variant="card">今日营养目标</AppText>
            <Badge variant={plan.dailyTarget.confidence === "HIGH" ? "positive" : "warning"}>{plan.dailyTarget.confidence === "HIGH" ? "高置信度" : "估算"}</Badge>
          </View>
          <View className="mt-4 flex-row gap-2">
            <Metric label="能量" value={plan.dailyTarget.energyKcal} unit="kcal" />
            <Metric label="碳水" value={plan.dailyTarget.carbohydrateG} unit="g" />
            <Metric label="蛋白质" value={plan.dailyTarget.proteinG} unit="g" />
          </View>
          <AppText variant="label" muted className="mt-3">目标来自{plan.dailyTarget.basis === "ESTIMATE" ? "当前训练与个人信息的估算" : "已记录数据"}</AppText>
        </Card>
      ) : null}
      {!loading && proposal ? <NutritionProposalCard proposal={proposal} applying={applying} validating={validating} onValidate={() => void validate()} onApply={() => void apply()} onDismiss={() => setProposal(null)} /> : null}
      {!loading && plan?.status === "NOT_GENERATED" ? (
        <EmptyState title="今天还没有饮食计划" description="根据你的饮食档案和训练安排生成一份可预览的建议草稿。" />
      ) : null}
      {!loading && plan?.status === "ACTIVE" && groupedItems.length === 0 ? (
        <EmptyState title="今天暂无餐次" description="可以重新生成今天的餐食与训练补给安排。" />
      ) : null}
      {!loading && groupedItems.length > 0 ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <AppText variant="section">今日安排</AppText>
            <AppText variant="caption" muted>{groupedItems.length} 个餐次</AppText>
          </View>
          {groupedItems.map((item) => <NutritionMealCard key={item.id} item={item} onSwap={(next) => setSwapItem(next)} />)}
        </View>
      ) : null}
      {!loading && profile ? (
        <Card className="p-4">
          <View className="flex-row items-center gap-2"><Sparkles color={colors.brand} size={17} /><AppText variant="card">让 AI 重新规划</AppText></View>
          <AppText variant="caption" muted className="mt-2 leading-5">生成的是草稿，会先经过结构和饮食限制校验。你确认应用后，正式计划才会更新。</AppText>
          <Button className="mt-4" loading={generating} onPress={() => void generate()}>
            {generationStatus === "RUNNING" ? "正在生成营养草稿" : "生成今日营养草稿"}
          </Button>
          {generationStatus ? <AppText variant="label" muted className="mt-2 text-center">{generationStatus === "QUEUED" ? "任务排队中" : "AI 生成与安全校验中"}</AppText> : null}
        </Card>
      ) : null}
      {feedback && !loading ? <Button variant="ghost" loading={refreshing} onPress={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}>{refreshing ? "刷新中" : "重新读取"}</Button> : null}
      <NutritionProfileSheet visible={profileOpen} profile={profile ? profileInputFromResponse(profile) : undefined} saving={savingProfile} onClose={() => setProfileOpen(false)} onSave={saveProfile} />
      <NutritionSwapSheet item={swapItem} busy={swapping} onClose={() => setSwapItem(null)} onSubmit={swap} />
    </Screen>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <View className="flex-1 rounded-xl bg-surface-2 p-3">
      <AppText variant="label" muted>{label}</AppText>
      <AppText variant="card" className="mt-1 text-brand">{value === null ? "—" : Math.round(value)}</AppText>
      <AppText variant="label" muted>{unit}</AppText>
    </View>
  );
}
