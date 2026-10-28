import { View } from "react-native";

import { AppHeader } from "./AppHeader";
import { EmptyState } from "../ui";
import { Screen } from "./Screen";

export function PlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Screen scroll>
      <View className="px-screen pt-4">
        <AppHeader title={title} compact />
        <EmptyState title="功能准备中" description={description} />
      </View>
    </Screen>
  );
}
