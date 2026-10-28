import { Stack } from "expo-router";

import { CoachFlowProvider } from "../../../src/features/coach/hooks/CoachFlowContext";

export default function CoachLayout() {
  return (
    <CoachFlowProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CoachFlowProvider>
  );
}
