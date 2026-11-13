import type { ReactNode } from "react";
import { View } from "react-native";
import { AppText } from "../../../components/ui";

export function SetupSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <AppText variant="section">{title}</AppText>
        {description ? (
          <AppText variant="caption" className="text-secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}
