import { CircleHelp } from "lucide-react-native";
import { View } from "react-native";

import { colors } from "../../theme/colors";
import { AppText } from "./AppText";
import { Card } from "./Card";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="items-center px-5 py-8 text-center">
      <View className="h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-2">
        <CircleHelp color={colors.brand} size={24} strokeWidth={1.7} />
      </View>
      <AppText variant="section" className="mt-4 text-center">
        {title}
      </AppText>
      <AppText variant="caption" muted className="mt-2 text-center leading-5">
        {description}
      </AppText>
    </Card>
  );
}
