import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Modal } from "react-native";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { waitForCoachProposal } from "../../coach/services/generation-task";
import { AppText } from "../../../components/ui";
import { Detail } from "../components/Detail";
import { TrainingPage, backToTraining } from "../components/TrainingPage";
import { WorkoutAdjustmentPreview } from "../components/WorkoutAdjustmentPreview";
import { WorkoutAdjustmentSheet } from "../components/WorkoutAdjustmentSheet";
import { WorkoutFeedbackSheet } from "../components/WorkoutFeedbackSheet";
import { useTrainingResource } from "../hooks/useTrainingResource";
import { addDays, iso } from "../model/training";
import { trainingApi } from "../services/training.api";

function weekStart(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  return addDays(value, -offset);
}

function requestKey(prefix: string, id: string) {
  return `${prefix}-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function WorkoutDetailScreen() {
  const { workoutId, action } = useLocalSearchParams<{
    workoutId: string;
    action?: string;
  }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof coachApi.proposal>
  > | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const autoOpened = useRef(false);
  const load = useCallback(async () => {
    if (!token || !workoutId) throw new Error("课程不存在或尚未登录");
    return trainingApi.getWorkout(token, workoutId);
  }, [token, workoutId]);
  const resource = useTrainingResource(load);
  useEffect(() => {
    if (
      resource.data &&
      resource.data.scheduledDate >= iso(new Date()) &&
      action === "adjust" &&
      !autoOpened.current
    ) {
      autoOpened.current = true;
      setAdjustOpen(true);
    }
  }, [action, resource.data]);

  const requestAdjustment = async (
    reason: Parameters<
      NonNullable<
        React.ComponentProps<typeof WorkoutAdjustmentSheet>["onSubmit"]
      >
    >[0],
    notes: string,
  ) => {
    if (!token || !resource.data) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const goals = await coachApi.goals(token);
      const goal =
        goals.find(
          (item) => item.status === "ACTIVE" && item.priority === "PRIMARY",
        ) ?? goals.find((item) => item.status === "ACTIVE");
      if (!goal) throw new Error("请先在 AI 教练中设置训练目标");
      const job = await coachApi.adjustWorkout(
        token,
        resource.data.id,
        {
          weekStartDate: weekStart(resource.data.scheduledDate),
          goalId: goal.id,
          mode: "replace_workout",
          expectedBaseVersion: resource.data.planVersion,
          targetWorkoutId: resource.data.id,
          reason,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        requestKey("adjust", resource.data.id),
      );
      const draft = await waitForCoachProposal(
        token,
        job,
        () => undefined,
        () => true,
      );
      if (!draft) throw new Error("调整任务已停止，请重试");
      setPreview(draft);
      setAdjustOpen(false);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "生成调整草稿失败",
      );
    } finally {
      setLoadingAction(false);
    }
  };

  const applyAdjustment = async () => {
    if (!token || !preview || !resource.data) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const validated = await coachApi.validate(token, preview.proposalId);
      if (validated.status !== "READY" || validated.blockers.length) {
        throw new Error(validated.blockers[0] ?? "草稿未通过校验，请返回修改");
      }
      await coachApi.apply(
        token,
        preview.proposalId,
        preview.basePlanVersion,
        requestKey("apply-adjustment", preview.proposalId),
      );
      setPreview(null);
      setActionError(null);
      resource.retry();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "应用调整失败，请重试",
      );
    } finally {
      setLoadingAction(false);
    }
  };

  const recordFeedback = async (input: {
    status: "COMPLETED" | "PARTIAL" | "SKIPPED";
    durationMin: number | null;
    rpe: number | null;
    fatigue: number | null;
    notes: string;
  }) => {
    if (!token || !resource.data) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      await coachApi.recordActivity(token, {
        workoutId: resource.data.id,
        localDate: resource.data.scheduledDate,
        ...input,
        notes: input.notes.trim() || null,
      });
      setFeedbackSaved(true);
      setFeedbackOpen(false);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "保存训练反馈失败",
      );
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <TrainingPage
      title="课程详情"
      onBack={backToTraining}
      loading={resource.loading}
      error={resource.error}
      retry={resource.retry}
    >
      {resource.data ? (
        <Detail
          workout={resource.data}
          onAdjust={() => {
            setActionError(null);
            setAdjustOpen(true);
          }}
          onFeedback={() => {
            setActionError(null);
            setFeedbackOpen(true);
          }}
          feedbackSaved={feedbackSaved}
          onEdit={() =>
            router.push({ pathname: "/workouts/editor", params: { workoutId } })
          }
        />
      ) : null}
      {resource.data ? (
        <WorkoutAdjustmentSheet
          visible={adjustOpen}
          loading={loadingAction}
          error={actionError}
          onClose={() => setAdjustOpen(false)}
          onSubmit={(reason, notes) => void requestAdjustment(reason, notes)}
        />
      ) : null}
      {resource.data ? (
        <WorkoutFeedbackSheet
          visible={feedbackOpen}
          loading={loadingAction}
          error={actionError}
          onClose={() => setFeedbackOpen(false)}
          onSubmit={(input) => void recordFeedback(input)}
        />
      ) : null}
      {resource.data && preview ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPreview(null)}
        >
          <WorkoutAdjustmentPreview
            original={resource.data}
            proposal={preview}
            loading={loadingAction}
            error={actionError}
            onApply={() => void applyAdjustment()}
            onClose={() => setPreview(null)}
          />
        </Modal>
      ) : null}
      {actionError && resource.data ? (
        <AppText variant="caption" className="mt-3 text-negative">
          {actionError}
        </AppText>
      ) : null}
    </TrainingPage>
  );
}
