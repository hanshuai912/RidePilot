import { useEffect, useState } from "react";
import { router, type Href } from "expo-router";
import { useUnsavedTraining } from "./useUnsavedTraining";

// Commit the success state before navigation so the unsaved/busy guard no
// longer blocks removing this page (including native back and swipe gestures).
export function useWorkoutActionExit(dirty: boolean, busy: boolean) {
  const [destination, setDestination] = useState<Href | null>(null);
  const guard = useUnsavedTraining(
    dirty && !destination,
    "返回将放弃本次输入，确认离开？",
    busy && !destination,
  );
  useEffect(() => {
    if (destination) router.dismissTo(destination);
  }, [destination]);
  return { guard, finish: setDestination };
}
