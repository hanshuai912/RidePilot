import { useState } from "react";
import { AppText } from "../../../components/ui";
import { TrainingPage } from "../components/TrainingPage";
import { WorkoutAdjustmentForm } from "../components/WorkoutAdjustmentForm";
import { useWorkoutActionRoute } from "../hooks/useWorkoutActionRoute";
import { useWorkoutActionExit } from "../hooks/useWorkoutActionExit";
import { useWorkoutAdjustment } from "../hooks/useWorkoutAdjustment";

export function WorkoutAdjustmentScreen() {
  const route = useWorkoutActionRoute();
  const action = useWorkoutAdjustment(route.token, route.data, route.source);
  const [dirty, setDirty] = useState(false);
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
      loading={route.loading}
      error={route.error}
      retry={route.retry}
    >
      {guard}
      {route.data ? (
        <AppText variant="caption" muted>
          {route.data.scheduledDate} · {route.data.title || "骑行训练"}
        </AppText>
      ) : null}
      {unavailable ? (
        <AppText>当前课程已记录或不可调整，请返回刷新计划。</AppText>
      ) : route.data ? (
        <WorkoutAdjustmentForm
          loading={action.busy}
          error={action.error}
          onClose={route.back}
          onSubmit={(reason, notes) => void action.generate(reason, notes)}
          onDirtyChange={setDirty}
          onChange={action.markChanged}
        />
      ) : null}
    </TrainingPage>
  );
}
