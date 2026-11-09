import { useState } from "react";
import type { WorkoutSegment } from "@ridepilot/contracts";
import { Button, Dialog } from "../../../components/ui";
import { useUnsavedTraining } from "../hooks/useUnsavedTraining";
import { WorkoutSegmentForm } from "./WorkoutSegmentForm";

export function InlineWorkoutSegmentEditor({
  initial,
  hasFtp,
  onBack,
  onSave,
}: {
  initial?: WorkoutSegment;
  hasFtp: boolean;
  onBack: () => void;
  onSave: (segment: WorkoutSegment) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const guard = useUnsavedTraining(
    dirty,
    "当前动作未保存，返回将放弃本次动作修改。",
  );
  return (
    <>
      {guard}
      <WorkoutSegmentForm
        initial={initial}
        hasFtp={hasFtp}
        onDirtyChange={setDirty}
        onCancel={() => (dirty ? setDiscard(true) : onBack())}
        onSave={onSave}
      />
      <Dialog
        visible={discard}
        title="放弃动作修改？"
        description="尚未保存的动作参数将被丢弃，已保存的课程草稿保留。"
        onClose={() => setDiscard(false)}
      >
        <Button variant="danger" onPress={onBack}>
          放弃动作修改
        </Button>
      </Dialog>
    </>
  );
}
