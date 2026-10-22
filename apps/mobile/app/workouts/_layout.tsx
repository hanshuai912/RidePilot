import { Stack } from "expo-router";
import { useAuth } from "../../src/features/auth/hooks/AuthProvider";
import { TrainingDraftProvider } from "../../src/features/training/hooks/TrainingDraftProvider";
import { colors } from "../../src/theme/tokens";

export default function WorkoutLayout() {
  const { session } = useAuth();
  return (
    <TrainingDraftProvider key={session?.user.id}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="new" options={{ title: "添加计划" }} />
        <Stack.Screen name="editor" options={{ title: "手动课程" }} />
        <Stack.Screen name="segment" options={{ title: "编辑训练动作" }} />
        <Stack.Screen name="preview" options={{ title: "保存当天课程" }} />
        <Stack.Screen name="[workoutId]" options={{ title: "课程详情" }} />
      </Stack>
    </TrainingDraftProvider>
  );
}
