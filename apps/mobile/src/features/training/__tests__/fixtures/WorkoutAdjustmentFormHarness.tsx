import { Button } from "../../../../components/ui";
import { WorkoutAdjustmentForm } from "../../components/WorkoutAdjustmentForm";
import {
  useWorkoutAdjustmentForm,
  type SubmitWorkoutAdjustment,
} from "../../hooks/useWorkoutAdjustmentForm";

export function WorkoutAdjustmentFormHarness({
  scheduledDate,
  loading,
  error,
  onSubmit,
  onDirtyChange,
  onChange,
}: {
  scheduledDate: string;
  loading: boolean;
  error: string | null;
  onSubmit: SubmitWorkoutAdjustment;
  onDirtyChange: (dirty: boolean) => void;
  onChange: () => void;
}) {
  const form = useWorkoutAdjustmentForm(scheduledDate, onDirtyChange, onChange);
  return (
    <>
      <Button
        disabled={loading || !form.canSubmit}
        onPress={() => form.requestSubmit(onSubmit)}
      >
        生成
      </Button>
      <WorkoutAdjustmentForm
        form={form}
        loading={loading}
        error={error}
        onSubmit={onSubmit}
      />
    </>
  );
}
