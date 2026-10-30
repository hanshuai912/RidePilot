import { useCallback, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useTrainingResource } from "../../training/hooks/useTrainingResource";
import { useWorkoutActionExit } from "../../training/hooks/useWorkoutActionExit";
import { StageTimeline } from "../components/StageTimeline";
import { goalsApi } from "../services/goals.api";

export function StagePreviewScreen() {
  const { proposalId = "", goalId = "" } = useLocalSearchParams<{
    proposalId?: string;
    goalId?: string;
  }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(async () => {
    if (!token) throw new Error("请先登录");
    return goalsApi.stagePlan(token, proposalId);
  }, [token, proposalId]);
  const resource = useTrainingResource(load);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const exit = useWorkoutActionExit(false, busy);
  const apply = async () => {
    if (!token || !resource.data || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await goalsApi.activateStages(token, proposalId, resource.data.version);
      exit.finish({
        pathname: "/goals/[goalId]",
        params: { goalId: resource.data.goalId },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "确认失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: "/goals/[goalId]", params: { goalId } });
  return (
    <TrainingPage
      title="阶段预览"
      onBack={back}
      busy={busy}
      loading={resource.loading}
      error={resource.error}
      retry={resource.retry}
    >
      {exit.guard}
      {resource.data ? (
        <>
          <AppText variant="label" className="text-brand">
            {resource.data.status === "DRAFT"
              ? "阶段草稿 · 尚未确认"
              : resource.data.status === "ACTIVE"
                ? "当前阶段安排"
                : "历史阶段安排"}
          </AppText>
          <StageTimeline plan={resource.data} />
          <AppText muted>
            确认后保存这份阶段安排。具体课程需要另行生成与确认，已有课程不会因此改变。
          </AppText>
          {error ? <AppText className="text-negative">{error}</AppText> : null}
          {resource.data.status === "DRAFT" ? (
            <Button
              loading={busy}
              disabled={resource.data.stale}
              onPress={() => void apply()}
            >
              确认阶段安排
            </Button>
          ) : null}
          <Button variant="secondary" disabled={busy} onPress={back}>
            返回目标
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
