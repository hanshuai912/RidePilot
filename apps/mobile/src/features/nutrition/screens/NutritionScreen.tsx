import { Pressable, View } from "react-native";
import { Settings2 } from "lucide-react-native";
import { AppHeader } from "../../../components/layout/AppHeader";
import { Screen } from "../../../components/layout/Screen";
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  Spinner,
} from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { addDays } from "../../coach/model/plan-dates";
import { NutritionGenerationCard } from "../components/NutritionGenerationCard";
import { NutritionEditableMeals } from "../components/NutritionEditableMeals";
import { TrainingNutritionLinkCard } from "../components/TrainingNutritionLinkCard";
import { NutritionProfileSheet } from "../components/NutritionProfileSheet";
import { NutritionProposalCard } from "../components/NutritionProposalCard";
import { NutritionSwapSheet } from "../components/NutritionSwapSheet";
import { profileInputFromResponse } from "../model/nutrition";
import { useNutritionPlan } from "../hooks/useNutritionPlan";

function sectionTitle(date: string) {
  if (!date) return "今日安排";
  const [, month, day] = date.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}

export function NutritionScreen() {
  const flow = useNutritionPlan();
  if (!flow.token) {
    return (
      <Screen>
        <AppText className="p-4">请先登录后查看饮食计划。</AppText>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      scrollProps={{
        contentContainerClassName: "grow gap-6 px-screen pb-10 pt-3",
      }}
    >
      <AppHeader
        className="!mb-0"
        title="饮食"
        subtitle={`${sectionTitle(flow.date ?? flow.plan?.from ?? "")} · 三餐与骑行补给`}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="编辑饮食档案"
            className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
            onPress={flow.openProfile}
          >
            <Settings2 color={colors.textPrimary} size={18} />
          </Pressable>
        }
      />
      {flow.feedback ? (
        <AppText
          variant="caption"
          accessibilityRole={
            flow.feedbackTone === "error" ? "alert" : undefined
          }
          accessibilityLiveRegion="polite"
          className={`rounded-xl border px-3 py-2 ${flow.feedbackTone === "success" ? "border-positive/40 bg-positive/10 text-positive" : "border-negative/40 bg-negative/10 text-negative"}`}
        >
          {flow.feedback}
        </AppText>
      ) : null}
      {flow.loading ? (
        <Card className="items-center py-10">
          <Spinner accessibilityLabel="正在加载饮食计划" />
          <AppText variant="caption" muted className="mt-3">
            正在读取今日饮食安排
          </AppText>
        </Card>
      ) : null}
      {!flow.loading && !flow.profile ? (
        <Card className="border-brand/50 bg-surface-elevated p-5">
          <Badge variant="brand">开始前先告诉我</Badge>
          <AppText variant="section" className="mt-3">
            建立你的饮食档案
          </AppText>
          <AppText variant="caption" muted className="mt-2 leading-5">
            选择饮食方式、过敏原和日常习惯，AI 才能生成更安全的餐食建议。
          </AppText>
          <Button className="mt-5" onPress={flow.openProfile}>
            填写饮食档案
          </Button>
        </Card>
      ) : null}
      {!flow.loading && flow.proposal ? (
        <NutritionProposalCard
          proposal={flow.proposal}
          applying={flow.applying}
          validating={flow.validating}
          onValidate={() => void flow.validate()}
          onApply={() => void flow.apply()}
          onDismiss={flow.dismissProposal}
        />
      ) : null}
      {!flow.loading && flow.profile ? (
        <NutritionGenerationCard
          generating={flow.generating}
          status={flow.generationStatus}
          hasPlan={flow.plan?.status === "ACTIVE"}
          hasDraft={!!flow.proposal}
          disabled={!flow.plan || flow.applying || flow.validating}
          onGenerate={() => void flow.generate()}
          cancellation={flow.cancellation}
        />
      ) : null}
      {!flow.loading && flow.plan?.dailyTarget ? (
        <Card className="p-4">
          <View className="flex-row items-center justify-between">
            <AppText variant="card">今日营养目标</AppText>
            <Badge
              variant={
                flow.plan.dailyTarget.confidence === "HIGH"
                  ? "positive"
                  : "warning"
              }
            >
              {flow.plan.dailyTarget.confidence === "HIGH"
                ? "高置信度"
                : "估算"}
            </Badge>
          </View>
          <View className="mt-4 flex-row gap-2">
            <Metric
              label="能量"
              value={flow.plan.dailyTarget.energyKcal}
              unit="kcal"
            />
            <Metric
              label="碳水"
              value={flow.plan.dailyTarget.carbohydrateG}
              unit="g"
            />
            <Metric
              label="蛋白质"
              value={flow.plan.dailyTarget.proteinG}
              unit="g"
            />
          </View>
          <AppText variant="caption" muted className="mt-3">
            目标来自
            {flow.plan.dailyTarget.basis === "ESTIMATE"
              ? "当前训练与个人信息的估算"
              : "已记录数据"}
          </AppText>
        </Card>
      ) : null}
      {!flow.loading && flow.plan?.status === "NOT_GENERATED" ? (
        <EmptyState
          title="今天还没有饮食计划"
          description="根据你的饮食档案和训练安排生成一份可预览的建议草稿。"
        />
      ) : null}
      {!flow.loading &&
      flow.plan?.status === "ACTIVE" &&
      flow.items.length === 0 ? (
        <EmptyState
          title="今天暂无餐次"
          description="可以重新生成今天的餐食与训练补给安排。"
        />
      ) : null}
      {!flow.loading && flow.items.length > 0 ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <AppText variant="section">今日正式安排</AppText>
            <AppText variant="caption" muted>
              {flow.items.length} 个餐次
            </AppText>
          </View>
          {flow.plan ? (
            <NutritionEditableMeals
              plan={flow.plan}
              token={flow.token}
              onSwap={flow.openSwap}
              onProposal={flow.acceptProposal}
              onError={flow.reportError}
            />
          ) : null}
        </View>
      ) : null}
      {!flow.loading && flow.date ? (
        <TrainingNutritionLinkCard
          dates={[flow.date, addDays(flow.date, 6)]}
          checkStatus
        />
      ) : null}
      {flow.feedback && flow.feedbackTone === "error" && !flow.loading ? (
        <Button
          variant="ghost"
          loading={flow.refreshing}
          onPress={() => void flow.refresh()}
        >
          {flow.refreshing ? "刷新中" : "重新读取"}
        </Button>
      ) : null}
      <NutritionProfileSheet
        visible={flow.profileOpen}
        profile={
          flow.profile ? profileInputFromResponse(flow.profile) : undefined
        }
        saving={flow.savingProfile}
        error={flow.profileError}
        onClose={flow.closeProfile}
        onSave={flow.saveProfile}
      />
      <NutritionSwapSheet
        item={flow.swapItem}
        busy={flow.swapping}
        error={flow.swapError}
        onClose={flow.closeSwap}
        onSubmit={flow.swap}
      />
    </Screen>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <View className="min-w-[80px] flex-1 gap-1">
      <AppText variant="label" muted>
        {label}
      </AppText>
      <AppText variant="card" className="mt-1">
        {value === null ? "—" : Math.round(value)}
      </AppText>
      <AppText variant="label" muted>
        {unit}
      </AppText>
    </View>
  );
}
