import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Screen } from "../../../components/layout/Screen";
import { AppText } from "../../../components/ui";
import { CoachChatEntry } from "./CoachChatEntry";

export function CoachDashboardPage({
  children,
  error,
}: {
  children: ReactNode;
  error: string | null;
}) {
  return (
    <Screen>
      <ScrollView
        testID="coach-page-content"
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 mt-3 flex-row items-center justify-between gap-4">
          <AppText variant="display" accessibilityRole="header">
            AI 教练
          </AppText>
          <CoachChatEntry />
        </View>
        <View testID="coach-dashboard-sections" className="gap-6">
          {children}
        </View>
        {error ? (
          <AppText accessibilityRole="alert" className="mt-4 text-negative">
            {error}
          </AppText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
