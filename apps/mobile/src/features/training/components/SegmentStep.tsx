import { View } from "react-native";
import { useState } from "react";
import type { WorkoutSegment } from "@ridepilot/contracts";
import { WorkoutSegmentForm } from "./WorkoutSegmentForm";
import { styles } from "./training.styles";
import { useUnsavedTraining } from "../hooks/useUnsavedTraining";

export function SegmentStep({
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
  const guard = useUnsavedTraining(
    dirty,
    "当前动作尚未保存，确认返回将放弃这次动作修改。",
  );
  return (
    <View style={styles.page}>
      {guard}
      <WorkoutSegmentForm
        initial={initial}
        hasFtp={hasFtp}
        onCancel={onBack}
        onDirtyChange={setDirty}
        onSave={(segment) => {
          setDirty(false);
          onSave(segment);
        }}
      />
    </View>
  );
}
