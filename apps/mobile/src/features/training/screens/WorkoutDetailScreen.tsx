import { useCallback, useRef, useState } from "react";
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
import { addDays } from "../model/training";
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
  return (
    <WorkoutDetailContent
      key={`${session?.user.id}-${workoutId}`}
      workoutId={workoutId}
      action={action}
      token={session?.accessToken}
    />
  );
}

function WorkoutDetailContent({
  workoutId,
  action,
  token,
}: {
  workoutId: string;
  action?: string;
  token?: string;
}) {
  const [adjustOpen, setAdjustOpen] = useState(action === "adjust");
  const [feedbackOpen, setFeedbackOpen] = useState(action === "feedback");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof coachApi.proposal>
  > | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const applyAttempt = useRef<{ id: string; key: string } | null>(null);
  const actionBusy = useRef(false);
  const load = useCallback(async () => {
    if (!token || !workoutId) throw new Error("课程不存在或尚未登录");
    return trainingApi.getWorkout(token, workoutId);
  }, [token, workoutId]);
  const resource = useTrainingResource(load);
  const requestAdjustment = async (
    reason: Parameters<
      NonNullable<
        React.ComponentProps<typeof WorkoutAdjustmentSheet>["onSubmit"]
      >
    >[0],
    notes: string,
  ) => {
    if (!token || !resource.data || actionBusy.current) return;
    actionBusy.current = true;
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
      applyAttempt.current = null;
      setAdjustOpen(false);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "生成调整草稿失败",
      );
    } finally {
      actionBusy.current = false;
      setLoadingAction(false);
    }
  };

  const applyAdjustment = async () => {
    if (!token || !preview || !resource.data || actionBusy.current) return;
    actionBusy.current = true;
    setLoadingAction(true);
    setActionError(null);
    try {
      // After an uncertain response retry the same write, without revalidating an
      // already-applied proposal or allocating another idempotency key.
      if (applyAttempt.current?.id !== preview.proposalId) {
        const validated = await coachApi.validate(token, preview.proposalId);
        if (validated.status !== "READY" || validated.blockers.length)
          throw new Error(
            validated.blockers[0] ?? "草稿未通过校验，请返回修改",
          );
        applyAttempt.current = {
          id: preview.proposalId,
          key: requestKey("apply-adjustment", preview.proposalId),
        };
      }
      const applied = await coachApi.apply(
        token,
        preview.proposalId,
        preview.basePlanVersion,
        applyAttempt.current.key,
      );
      setPreview(null);
      // Published snapshots allocate new workout IDs. The calendar reloads the
      // new snapshot on focus; reloading this old detail would show stale data.
      router.replace({
        pathname: "/(tabs)/training",
        params: {
          date: applied.affectedDates[0] ?? resource.data.scheduledDate,
          savedAt: String(Date.now()),
        },
      });
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "应用调整失败，请重试",
      );
    } finally {
      actionBusy.current = false;
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
    if (!token || !resource.data || actionBusy.current) return;
    actionBusy.current = true;
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
      resource.retry();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "保存训练反馈失败",
      );
    } finally {
      actionBusy.current = false;
      setLoadingAction(false);
    }
  };

  return (
    <TrainingPage
      title="课程详情"
      onBack={() => {
        if (!actionBusy.current) backToTraining();
      }}
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
          busy={loadingAction}
          onEdit={() =>
            router.push({ pathname: "/workouts/editor", params: { workoutId } })
          }
        />
      ) : null}
      {resource.data ? (
        <WorkoutAdjustmentSheet
          visible={
            adjustOpen &&
            !resource.data.activity &&
            resource.data.editable !== false
          }
          loading={loadingAction}
          error={actionError}
          onClose={() => {
            if (!actionBusy.current) setAdjustOpen(false);
          }}
          onSubmit={(reason, notes) => void requestAdjustment(reason, notes)}
        />
      ) : null}
      {resource.data ? (
        <WorkoutFeedbackSheet
          visible={feedbackOpen && !resource.data.activity}
          loading={loadingAction}
          error={actionError}
          onClose={() => {
            if (!actionBusy.current) setFeedbackOpen(false);
          }}
          onSubmit={(input) => void recordFeedback(input)}
        />
      ) : null}
      {resource.data && preview ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!actionBusy.current) setPreview(null);
          }}
        >
          <WorkoutAdjustmentPreview
            original={resource.data}
            proposal={preview}
            loading={loadingAction}
            error={actionError}
            onApply={() => void applyAdjustment()}
            onClose={() => {
              if (!actionBusy.current) setPreview(null);
            }}
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
