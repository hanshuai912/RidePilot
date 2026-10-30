import { useEffect, useState } from "react";
import { AppText } from "../../../components/ui";
import { TrainingPage } from "../components/TrainingPage";
import { WorkoutFeedbackForm } from "../components/WorkoutFeedbackForm";
import { useWorkoutActionRoute } from "../hooks/useWorkoutActionRoute";
import { useWorkoutActionExit } from "../hooks/useWorkoutActionExit";
import { useWorkoutFeedback } from "../hooks/useWorkoutFeedback";
import { workoutActionDestination } from "../model/workout-action-navigation";

export function WorkoutFeedbackScreen() {
  const route = useWorkoutActionRoute();
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const action = useWorkoutFeedback(route.token, route.data, () =>
    setSaved(true),
  );
  const { guard, finish } = useWorkoutActionExit(dirty, action.busy || saved);
  // Saving clears the route guard before dismissing back to the source page.
  // The source reloads its data on focus.
  const date = route.data?.scheduledDate;
  useEffect(() => {
    if (saved)
      finish(
        workoutActionDestination(route.source, route.workoutId, {
          date,
          saved: true,
        }),
      );
  }, [saved, route.source, route.workoutId, date, finish]);
  return (
    <TrainingPage
      title="记录完成"
      onBack={route.back}
      busy={action.busy || saved}
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
      {route.data?.activity ? (
        <AppText>已记录训练反馈，无需重复提交。</AppText>
      ) : route.data ? (
        <WorkoutFeedbackForm
          loading={action.busy || saved}
          error={action.error}
          onClose={route.back}
          onSubmit={(input) => void action.save(input)}
          onDirtyChange={setDirty}
        />
      ) : null}
    </TrainingPage>
  );
}
