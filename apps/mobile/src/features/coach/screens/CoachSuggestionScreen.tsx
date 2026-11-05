import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { TrainingPage } from "../../training/components/TrainingPage";
import { NutritionDraftReview } from "../../nutrition/components/NutritionDraftReview";
import { TrainingNutritionLinkCard } from "../../nutrition/components/TrainingNutritionLinkCard";
import { PlanPreview } from "../components/PlanPreview";
import { useCoachSuggestion } from "../hooks/useCoachSuggestion";

export function CoachSuggestionScreen() {
  const { id = "", kind = "" } = useLocalSearchParams<{
    id?: string;
    kind?: string;
  }>();
  const { session } = useAuth();
  const router = useRouter();
  const state = useCoachSuggestion(session?.accessToken, id, kind);
  const proposal = state.data?.proposal;
  const editable =
    !!proposal && ["DRAFT", "READY", "BLOCKED"].includes(proposal.status);
  return (
    <TrainingPage
      title="教练建议预览"
      onBack={() => router.replace("/(tabs)/coach/suggestions")}
      busy={state.busy}
      loading={state.loading}
    >
      {state.error ? (
        <>
          <AppText className="text-negative">{state.error}</AppText>
          <Button onPress={state.retry}>重新读取建议</Button>
        </>
      ) : null}
      {proposal ? (
        <AppText variant="label" className="text-brand">
          {proposal.status === "APPLIED"
            ? "建议已应用"
            : editable
              ? "建议草稿 · 尚未应用"
              : `历史建议 · ${proposal.status}`}
        </AppText>
      ) : null}
      {state.data?.kind === "TRAINING" ? (
        <PlanPreview proposal={state.data.proposal} ftpWatts={null} />
      ) : null}
      {state.data?.kind === "NUTRITION" ? (
        <>
          <Card>
            <AppText variant="card">
              {state.data.proposal.metadata?.summary ?? "饮食与补给草稿"}
            </AppText>
            <AppText muted className="mt-2">
              基于饮食 v{state.data.proposal.baseNutritionVersion} ·
              确认后独立更新饮食计划
            </AppText>
          </Card>
          <NutritionDraftReview proposal={state.data.proposal} />
          {[
            ...state.data.proposal.validation.warnings,
            ...state.data.proposal.validation.blockers,
          ].map((text, i) => (
            <AppText key={i} className="text-warning">
              {text}
            </AppText>
          ))}
        </>
      ) : null}
      {state.actionError ? (
        <>
          <AppText className="text-negative">{state.actionError}</AppText>
          <Button variant="ghost" disabled={state.busy} onPress={state.retry}>
            刷新草稿状态
          </Button>
        </>
      ) : null}
      {editable ? (
        state.confirm ? (
          <Card>
            <AppText variant="card">确认应用这份建议？</AppText>
            <AppText className="mt-2" muted>
              将按上方差异更新正式{kind === "NUTRITION" ? "饮食" : "训练"}
              计划，历史实际记录会保留。
            </AppText>
            <Button
              className="mt-3"
              loading={state.busy}
              onPress={() => void state.apply()}
            >
              确认应用到正式计划
            </Button>
            <Button
              variant="ghost"
              disabled={state.busy}
              onPress={() => state.setConfirm(false)}
            >
              继续查看
            </Button>
          </Card>
        ) : (
          <Button
            loading={state.busy}
            onPress={() =>
              state.checked ? state.setConfirm(true) : void state.validate()
            }
          >
            {state.checked ? "预览完成，准备应用" : "校验这份建议"}
          </Button>
        )
      ) : null}
      {proposal?.status === "APPLIED" &&
      kind === "TRAINING" &&
      state.affectedDates.length ? (
        <TrainingNutritionLinkCard dates={state.affectedDates} />
      ) : null}
      <Button
        variant="secondary"
        disabled={state.busy}
        onPress={() => router.replace("/(tabs)/coach/suggestions")}
      >
        返回建议列表
      </Button>
    </TrainingPage>
  );
}
