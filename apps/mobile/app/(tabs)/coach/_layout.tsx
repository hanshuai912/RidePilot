import { Stack } from "expo-router";

import { CoachFlowProvider } from "../../../src/features/coach/hooks/CoachFlowContext";
import { colors } from "../../../src/theme/tokens";

export default function CoachLayout() {
  return (
    <CoachFlowProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "none",
          animationDuration: 280,
        }}
      />
    </CoachFlowProvider>
  );
}
