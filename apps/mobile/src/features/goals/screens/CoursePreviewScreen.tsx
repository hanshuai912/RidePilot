import { useCallback, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { PlanPreview } from "../../coach/components/PlanPreview";
import { coachApi } from "../../coach/services/coach.api";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useTrainingResource } from "../../training/hooks/useTrainingResource";
import { useWorkoutActionExit } from "../../training/hooks/useWorkoutActionExit";

export function CoursePreviewScreen() {
  const { proposalId = "" } = useLocalSearchParams<{ proposalId?: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(async () => {
    if (!token) throw new Error("请先登录");
    const [proposal, ftp] = await Promise.all([
      coachApi.proposal(token, proposalId),
      coachApi.ftp(token),
    ]);
    if (proposal.scene !== "RANGE_PLAN") throw new Error("课程草稿范围不匹配");
    return { proposal, ftp };
  }, [token, proposalId]);
  const resource = useTrainingResource(load);
  const [busy, setBusy] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const appliedAttempt = useRef(false);
  const exit = useWorkoutActionExit(false, busy);
  const confirm = async () => {
    if (!token || !resource.data || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const proposal = resource.data.proposal;
      if (!validated && !appliedAttempt.current) {
        if (proposal.status === "APPLIED")
          throw new Error("此草稿已应用，请返回训练日历查看");
        const result = await coachApi.validate(token, proposalId);
        if (result.status !== "READY" || result.blockers.length)
          throw new Error(result.blockers.join("；") || "草稿未通过校验");
        setValidated(true);
        return;
      }
      appliedAttempt.current = true;
      const result = await coachApi.apply(
        token,
        proposalId,
        proposal.basePlanVersion,
        `apply-range-${proposalId}`,
      );
      exit.finish({
        pathname: "/(tabs)/training",
        params: { date: result.affectedDates[0], savedAt: String(Date.now()) },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "应用失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/goals");
  return (
    <TrainingPage
      title="课程预览"
      onBack={back}
      busy={busy}
      loading={resource.loading}
      error={resource.error}
      retry={resource.retry}
    >
      {exit.guard}
      {resource.data ? (
        <>
          <PlanPreview
            proposal={resource.data.proposal}
            ftpWatts={resource.data.ftp?.valueWatts ?? null}
            nutritionSummary="本次不调整饮食"
          />
          {validated ? (
            <AppText className="text-positive">
              校验通过。确认后将应用以上课程，并替换预览中列出的未来课程。
            </AppText>
          ) : null}
          {error ? <AppText className="text-negative">{error}</AppText> : null}
          {resource.data.proposal.status !== "APPLIED" ? (
            <Button loading={busy} onPress={() => void confirm()}>
              {validated ? "确认应用课程" : "校验课程草稿"}
            </Button>
          ) : (
            <AppText>此草稿已应用</AppText>
          )}
          <Button variant="secondary" disabled={busy} onPress={back}>
            返回修改条件
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
