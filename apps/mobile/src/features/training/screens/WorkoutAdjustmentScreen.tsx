import { GenerationCancelButton } from "../../coach/components/GenerationCancelButton";
import { useState } from "react";
import { View } from "react-native";
import { AppText } from "../../../components/ui";
import { useWorkoutAdjustmentForm } from "../hooks/useWorkoutAdjustmentForm";
import { TrainingPage } from "../components/TrainingPage";
import { WorkoutAdjustmentForm } from "../components/WorkoutAdjustmentForm";
import { useWorkoutActionRoute } from "../hooks/useWorkoutActionRoute";
import { useWorkoutActionExit } from "../hooks/useWorkoutActionExit";
import { useWorkoutAdjustment } from "../hooks/useWorkoutAdjustment";
import { useFtpRequirement } from "../hooks/useFtpRequirement";
import { FtpRequiredState } from "../components/FtpRequiredState";

export function WorkoutAdjustmentScreen() {
  const route = useWorkoutActionRoute();
  const ftp = useFtpRequirement();
  const action = useWorkoutAdjustment(route.token, route.data, route.source);
  const [dirty, setDirty] = useState(false);
  const form = useWorkoutAdjustmentForm(
    route.data?.scheduledDate,
    setDirty,
    action.markChanged,
  );
  const submit = () => {
    if (!action.busy)
      form.requestSubmit((reason, notes, endDate) => {
        void action.generate(reason, notes, endDate);
      });
  };
  const { guard } = useWorkoutActionExit(
    dirty && !action.generated,
    action.busy,
  );
  const unavailable =
    route.data && (route.data.activity || route.data.editable === false);
  return (
    <TrainingPage
      title="调整训练"
      onBack={route.back}
      busy={action.busy}
      loading={route.loading || (ftp.available === null && !ftp.error)}
      error={route.error ?? ftp.error}
      retry={() => {
        route.retry();
        ftp.retry();
      }}
    >
      {guard}
      <View className="gap-6 pt-4">
        {route.data ? (
          <View
            testID="workout-adjustment-context"
            className="gap-2 rounded-card border border-border bg-surface p-4"
          >
            <AppText variant="caption" className="text-secondary">
              本次调整的课程
            </AppText>
            <AppText variant="section">
              {route.data.title || "骑行训练"}
            </AppText>
            <AppText variant="caption" className="text-secondary">
              {route.data.scheduledDate}
              {route.data.timeTargetMinutes
                ? ` · ${route.data.timeTargetMinutes} 分钟`
                : ""}{" "}
              · 正式计划 v{route.data.planVersion}
            </AppText>
          </View>
        ) : null}
        {ftp.available === false ? (
          <FtpRequiredState />
        ) : unavailable ? (
          <AppText>当前课程已记录或不可调整，请返回刷新计划。</AppText>
        ) : route.data ? (
          <WorkoutAdjustmentForm
            form={form}
            loading={action.busy}
            error={action.error}
            onRequestSubmit={submit}
            disabled={
              !!route.error ||
              !!ftp.error ||
              ftp.available !== true ||
              !form.canSubmit
            }
            onSubmit={(reason, notes, endDate) =>
              void action.generate(reason, notes, endDate)
            }
          />
        ) : null}
        {action.busy ? (
          <GenerationCancelButton cancellation={action.cancellation} />
        ) : null}
      </View>
    </TrainingPage>
  );
}
